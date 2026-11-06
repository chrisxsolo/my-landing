# Scheduled publishing — architecture (2026-11-06)

Implements drafts + per-post future publication for standalone blog posts and
Content Engine items. Companion to the handoff in
`2026-11-06-scheduled-content-publishing-claude-handoff.md`.

## Discovery facts that shaped the design

- Vercel team plan is **Hobby** (`vercel teams ls`): cron is daily only.
- The GitHub Actions 5-minute tick (`content-engine-worker.yml`) actually fires
  every 3–8 **hours** in this repo (`gh run list`), so it is not a scheduler.
- Supabase prod has `pg_cron` 1.6.4 and `pg_net` 0.20 available (not yet
  enabled) and `supabase_vault` installed. Local stack has both too.
- `blog_posts` in prod: 21 rows, 0 future-dated, 0 null dates — no legacy
  anomalies to reconcile.
- Public readers (`lib/professionalData.ts`) had no `published_at <= now()`
  filter; added as defence in depth (nothing in prod changes visibility).

## Shape

| Piece | Where |
| --- | --- |
| Private standalone drafts | `public.blog_post_drafts` (text + image refs; images in the private `blog-drafts` bucket) |
| One publication queue | `public.publication_schedules` — exactly one target (`content_item_id` xor `blog_draft_id`), one active row per target, `due_at` UTC + IANA zone + wall time, `source_revision`, `schedule_version`, lease/claim token, retry fields, actual `published_at`, live target identity, `refresh_pending` |
| Worker heartbeat | `public.publication_worker_runs` |
| Atomic claim | RPC `claim_publication_schedules(limit, lease)` — `FOR UPDATE SKIP LOCKED`, due + retry-eligible only |
| Engine commit | RPC `publish_scheduled_content_item(schedule, token)` — verifies claim/revision/due inside the txn, then calls the existing `publish_session_content_item`, then marks the schedule published |
| Blog draft commit | RPC `publish_blog_post_draft(draft, schedule, token, public_images)` — inserts `blog_posts` + `image_library` + marks draft and schedule in one txn; a repeat returns the existing live id |
| Settle | JS update fenced by `claim_token` (`eq(id).eq(claim_token)`) |
| Trigger | pg_cron every minute → `public.tick_publication_worker()` → `net.http_get` to the canonical host with the bearer secret from Vault |
| Worker route | `app/api/content-publishing/worker` — bearer `CRON_SECRET`, fails closed, refuses preview deployments, no AI dependency |
| Admin APIs | `/api/admin/publication-schedules[/id]`, `/api/admin/blog-drafts[/id]`, `/api/admin/publication-schedules/health` |
| Shared libs | `lib/contentPublishing/*` (localTime, scheduleService, worker, blogDrafts, blogDraftImages, publishBlogDraft, refresh) |
| UI | `ScheduleControl` (shared), engine `ItemCard` schedule actions, `ActionBar` excludes queued items, `/admin/content-engine/schedule` queue page, BlogTab Save draft / Schedule / Publish now + Generate draft + drafts panel |

## Invariants

- Scheduling never promotes photos to public storage; that happens only in the
  worker after the claim and a permission re-check.
- A stale revision never publishes: autosave bumps `payload_revision`, the
  schedule binds `source_revision`, the commit RPC compares them.
- Cancel vs commit: the commit RPC locks the schedule row; a cancelled row can
  no longer be committed, and a committed row reports "already published".
- Published + failed cache refresh = `published` with `refresh_pending=true`;
  the worker retries the refresh on later ticks.
- Standalone drafts never touch `blog_posts` until publication, so no public
  reader can leak them. `published_at` on the live row is the actual time.

## Side effects / shared code touched

- `lib/contentEngine/publishItem.ts` gains an optional `schedule` argument
  (Step B switches to the scheduled RPC). Existing callers unchanged.
- `lib/contentEngine/itemTransitions.ts`: autosave and reject cancel any
  active schedule for the item.
- `lib/publicRevalidation.ts`: a result-returning refresh beside the existing
  void helper (existing callers keep the void helper).
- `lib/professionalData.ts`: public blog readers add `published_at <= now()`.
- `app/api/admin/session-content/sessions/[id]` returns `schedules`.
- `lib/adminUploadTargets.ts`: new `blog-draft` private target.

## Rollback

1. `select cron.unschedule('publication-worker-tick')` (stops execution).
2. Revert the app deploy (schedules stay queued, nothing publishes).
3. Only if the data is unwanted: run `*_rollback.sql` (drops the new tables,
   never `blog_posts`).
