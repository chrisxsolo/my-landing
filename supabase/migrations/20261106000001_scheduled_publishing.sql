-- Scheduled publishing (2026-11-06): private standalone blog drafts plus one
-- publication queue for both those drafts and Content Engine items.
--
-- Why two new tables and not a future published_at on blog_posts: every public
-- reader (listing, detail, category, sitemap, image library, page-photo pool)
-- reads blog_posts with the service role, so an unpublished row there is one
-- missed filter away from being public. A draft lives here until the exact
-- instant it is published; blog_posts only ever holds live posts, and its
-- published_at stays the ACTUAL first publication time.
--
-- The queue (publication_schedules) targets exactly one thing — an engine item
-- or a blog draft — and holds at most one active row per target. Workers claim
-- due rows atomically (claim_publication_schedules), do the slow work outside
-- any transaction, then commit through an RPC that re-checks the claim token,
-- the bound source revision and the due instant inside the same transaction
-- that writes the live row. Stale revisions, cancelled rows and expired claims
-- can therefore never publish.
--
-- Additive and idempotent. Nothing here changes blog_posts.

-- ── blog_post_drafts ────────────────────────────────────────────────────────
create table if not exists public.blog_post_drafts (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null default '',
  body               text not null default '',
  slug               text not null default '',
  category           text not null default 'professional',
  sites              text[] not null default array['professional']::text[],
  meta_description   text,
  meta_keywords      text,
  -- Ordered list; the first entry is the cover. Each entry is either a private
  -- object in the blog-drafts bucket ({"path": "<draft id>/<file>", "alt": ""})
  -- or an already-public image reused as is ({"url": "https://…", "alt": ""}).
  images             jsonb not null default '[]'::jsonb,
  source             text not null default 'manual' check (source in ('manual', 'ai_photos')),
  status             text not null default 'draft' check (status in ('draft', 'published')),
  -- Optimistic concurrency for edits AND the revision a schedule binds to.
  revision           int not null default 1,
  published_post_id  bigint references public.blog_posts(id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint blog_post_drafts_images_is_array check (jsonb_typeof(images) = 'array')
);

create index if not exists blog_post_drafts_status_updated_idx
  on public.blog_post_drafts (status, updated_at desc);

comment on table public.blog_post_drafts is
  'Unpublished standalone blog posts. Never read by public pages; published into blog_posts by publish_blog_post_draft.';

drop trigger if exists blog_post_drafts_set_updated_at on public.blog_post_drafts;
create trigger blog_post_drafts_set_updated_at
before update on public.blog_post_drafts
for each row execute function public.set_updated_at();

-- Private bucket for draft images. Promoted to the public grad-photos bucket
-- only by the publisher, after the claim and permission checks.
insert into storage.buckets (id, name, public)
values ('blog-drafts', 'blog-drafts', false)
on conflict (id) do nothing;

-- ── publication_schedules ───────────────────────────────────────────────────
create table if not exists public.publication_schedules (
  id                     uuid primary key default gen_random_uuid(),
  target_kind            text not null check (target_kind in ('content_item', 'blog_draft')),
  content_item_id        uuid references public.session_content_items(id) on delete cascade,
  blog_draft_id          uuid references public.blog_post_drafts(id) on delete cascade,

  -- The resolved UTC instant plus what the admin actually chose, so the queue
  -- can always show "9:00 AM — America/Los_Angeles" exactly as entered.
  due_at                 timestamptz not null,
  time_zone              text not null,
  local_wall_time        text not null,

  -- The reviewed content this schedule is bound to (payload_revision for an
  -- engine item, revision for a draft). The commit RPC refuses any other.
  source_revision        int not null,
  -- Bumped by every admin change; clients must send the version they saw.
  schedule_version       int not null default 1,

  state                  text not null default 'queued'
    check (state in ('queued', 'processing', 'published', 'blocked', 'failed', 'cancelled')),
  attempts               int not null default 0,
  next_attempt_at        timestamptz,
  last_error             text check (last_error is null or length(last_error) <= 2000),

  -- Held by the worker that claimed the row; settles are fenced by it.
  claim_token            uuid,
  lease_expires_at       timestamptz,

  -- Actual publication, never the planned one.
  published_at           timestamptz,
  published_target_type  text,
  published_target_id    text,
  -- Published, but the public cache refresh did not land yet (recoverable).
  refresh_pending        boolean not null default false,
  refresh_paths          jsonb not null default '[]'::jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint publication_schedules_one_target check (
    (target_kind = 'content_item' and content_item_id is not null and blog_draft_id is null)
    or (target_kind = 'blog_draft' and blog_draft_id is not null and content_item_id is null)
  ),
  constraint publication_schedules_published_shape check (
    state <> 'published' or (published_at is not null and published_target_type is not null)
  )
);

-- One live schedule per target: queued, processing, or waiting on the admin
-- (blocked / failed). Published and cancelled rows stay as history.
create unique index if not exists publication_schedules_active_item_idx
  on public.publication_schedules (content_item_id)
  where state in ('queued', 'processing', 'blocked', 'failed');
create unique index if not exists publication_schedules_active_draft_idx
  on public.publication_schedules (blog_draft_id)
  where state in ('queued', 'processing', 'blocked', 'failed');
create index if not exists publication_schedules_due_idx
  on public.publication_schedules (state, due_at);
create index if not exists publication_schedules_refresh_idx
  on public.publication_schedules (refresh_pending) where refresh_pending;

comment on table public.publication_schedules is
  'Publication queue: one row = one planned publication of an engine item or a blog draft.';

drop trigger if exists publication_schedules_set_updated_at on public.publication_schedules;
create trigger publication_schedules_set_updated_at
before update on public.publication_schedules
for each row execute function public.set_updated_at();

-- ── publication_worker_runs (heartbeat) ─────────────────────────────────────
create table if not exists public.publication_worker_runs (
  id           bigserial primary key,
  source       text not null default 'cron',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  claimed      int not null default 0,
  published    int not null default 0,
  blocked      int not null default 0,
  failed       int not null default 0,
  retried      int not null default 0,
  refreshed    int not null default 0,
  error        text
);
create index if not exists publication_worker_runs_started_idx
  on public.publication_worker_runs (started_at desc);

-- ── lockdown: service role only (same posture as content_engine_jobs) ───────
do $$
declare t text;
begin
  foreach t in array array['blog_post_drafts', 'publication_schedules', 'publication_worker_runs'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;
grant usage, select on sequence public.publication_worker_runs_id_seq to service_role;
-- Intentionally no anon/authenticated policies.

-- ── claim_publication_schedules ─────────────────────────────────────────────
-- Atomically claims up to p_limit rows: queued AND due (and past any retry
-- back-off), or processing under a lease that lapsed (a worker that died —
-- whether it was claimed by the tick or by the admin's Publish now, so no
-- due_at condition there). FOR UPDATE SKIP LOCKED keeps two concurrent ticks
-- off the same row. Every claim issues a fresh token; a stale worker's settle
-- no longer matches. A row that has burned through p_max_attempts claims is
-- retired as failed instead of being reclaimed forever. Nothing queued with
-- due_at in the future is ever returned.
-- An earlier two-argument draft of this function must not linger as an overload.
drop function if exists public.claim_publication_schedules(int, int);
create or replace function public.claim_publication_schedules(
  p_limit int default 5,
  p_lease_seconds int default 180,
  p_max_attempts int default 5
) returns setof public.publication_schedules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.publication_schedules
     set state = 'failed',
         last_error = coalesce(last_error, format('the publisher was interrupted %s times without finishing', attempts)),
         claim_token = null, lease_expires_at = null, next_attempt_at = null, updated_at = now()
   where state in ('queued', 'processing')
     and attempts >= p_max_attempts
     and (lease_expires_at is null or lease_expires_at <= now());

  return query
  update public.publication_schedules s
     set state = 'processing',
         claim_token = gen_random_uuid(),
         attempts = s.attempts + 1,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         next_attempt_at = null,
         updated_at = now()
   where s.id in (
     select s2.id from public.publication_schedules s2
      where s2.attempts < p_max_attempts
        and (
          (s2.state = 'queued' and s2.due_at <= now()
             and (s2.next_attempt_at is null or s2.next_attempt_at <= now()))
          or (s2.state = 'processing' and s2.lease_expires_at is not null and s2.lease_expires_at <= now())
        )
      order by s2.due_at, s2.created_at
      limit greatest(1, least(p_limit, 50))
      for update skip locked
   )
   returning s.*;
end;
$$;

-- ── claim_publication_schedule_now ──────────────────────────────────────────
-- The admin's "Publish now" on a queued/blocked/failed schedule: takes the
-- claim regardless of due_at, guarded by the version the admin saw. Returns
-- the claimed row, or nothing when the row moved (published, cancelled, being
-- processed, or edited elsewhere).
create or replace function public.claim_publication_schedule_now(
  p_schedule_id uuid,
  p_schedule_version int,
  p_lease_seconds int default 180
) returns setof public.publication_schedules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.publication_schedules s
     set state = 'processing',
         claim_token = gen_random_uuid(),
         attempts = s.attempts + 1,
         schedule_version = s.schedule_version + 1,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         next_attempt_at = null,
         updated_at = now()
   where s.id = p_schedule_id
     and s.schedule_version = p_schedule_version
     and s.state in ('queued', 'blocked', 'failed')
   returning s.*;
end;
$$;

-- ── publish_scheduled_content_item ──────────────────────────────────────────
-- Commits a claimed engine-item schedule. Everything the JavaScript side
-- checked before the slow derivative work is re-checked HERE, under the row
-- lock, in the transaction that writes the live row:
--   • the schedule is still processing under THIS claim token
--   • it is due (unless the admin asked for "now")
--   • the item is still the exact revision that was reviewed and scheduled
-- then the existing publisher runs (its own guards: approved, permission,
-- archived package, slug conflict, derivatives present) and the schedule is
-- marked published with the live target. A repeat call on a published
-- schedule reports already_published instead of raising.
create or replace function public.publish_scheduled_content_item(
  p_schedule_id uuid,
  p_claim_token uuid,
  p_allow_early boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.publication_schedules%rowtype;
  v_revision int;
  v_result jsonb;
begin
  select * into v_s from public.publication_schedules where id = p_schedule_id for update;
  if not found then raise exception 'schedule not found'; end if;
  if v_s.state = 'published' then
    return jsonb_build_object('already_published', true, 'item_id', v_s.content_item_id,
      'target_type', v_s.published_target_type, 'target_id', v_s.published_target_id);
  end if;
  if v_s.state <> 'processing' or v_s.claim_token is null or v_s.claim_token <> p_claim_token then
    raise exception 'schedule claim is not current (state=%)', v_s.state;
  end if;
  if v_s.target_kind <> 'content_item' then raise exception 'schedule is not for a content item'; end if;
  if not p_allow_early and v_s.due_at > now() then raise exception 'schedule is not due yet'; end if;

  select i.payload_revision into v_revision from public.session_content_items i where i.id = v_s.content_item_id;
  if not found then raise exception 'content item not found'; end if;
  if v_revision <> v_s.source_revision then
    raise exception 'content changed since it was scheduled (revision % was reviewed, % is current)',
      v_s.source_revision, v_revision;
  end if;

  v_result := public.publish_session_content_item(v_s.content_item_id);

  update public.publication_schedules
     set state = 'published',
         published_at = now(),
         published_target_type = v_result->>'target_type',
         published_target_id = v_result->>'target_id',
         claim_token = null,
         lease_expires_at = null,
         next_attempt_at = null,
         last_error = null,
         updated_at = now()
   where id = p_schedule_id;

  return v_result || jsonb_build_object('already_published', false);
end;
$$;

-- ── publish_blog_post_draft ─────────────────────────────────────────────────
-- Publishes a standalone draft: inserts the live blog_posts row and its
-- image_library rows, marks the draft published, and (when scheduled) marks
-- the schedule published — one transaction, so a crash can never leave a live
-- post without its bookkeeping or publish the same draft twice. p_images is
-- the ordered list of ALREADY PUBLIC images ({"url","alt"}; first = cover),
-- promoted by the caller before this commit. Without a schedule id it is the
-- admin's direct "Publish now" on an unscheduled draft.
create or replace function public.publish_blog_post_draft(
  p_draft_id uuid,
  p_schedule_id uuid,
  p_claim_token uuid,
  p_images jsonb,
  p_allow_early boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_d public.blog_post_drafts%rowtype;
  v_s public.publication_schedules%rowtype;
  v_img jsonb;
  v_cover_url text; v_cover_alt text;
  v_extra_urls text[] := '{}'; v_extra_alts text[] := '{}';
  v_post_id bigint;
  v_i int := 0;
begin
  select * into v_d from public.blog_post_drafts where id = p_draft_id for update;
  if not found then raise exception 'draft not found'; end if;

  if v_d.status = 'published' then
    -- A repeat delivery after a committed publication: settle the claimed
    -- schedule (under its token) so it cannot be reclaimed forever, create nothing.
    if p_schedule_id is not null then
      update public.publication_schedules
         set state = 'published', published_at = coalesce(published_at, v_d.published_at, now()),
             published_target_type = 'blog_post', published_target_id = v_d.published_post_id::text,
             claim_token = null, lease_expires_at = null, next_attempt_at = null, last_error = null, updated_at = now()
       where id = p_schedule_id and state = 'processing' and claim_token = p_claim_token;
    end if;
    return jsonb_build_object('already_published', true, 'post_id', v_d.published_post_id, 'slug', v_d.slug);
  end if;

  if p_schedule_id is null then
    -- A direct Publish now must not race a schedule: the queue owns a scheduled draft.
    if exists (select 1 from public.publication_schedules s
               where s.blog_draft_id = p_draft_id and s.state in ('queued', 'processing', 'blocked', 'failed')) then
      raise exception 'draft is scheduled — publish it through its schedule';
    end if;
  else
    select * into v_s from public.publication_schedules where id = p_schedule_id for update;
    if not found then raise exception 'schedule not found'; end if;
    if v_s.state = 'published' then
      return jsonb_build_object('already_published', true, 'post_id', v_d.published_post_id, 'slug', v_d.slug);
    end if;
    if v_s.state <> 'processing' or v_s.claim_token is null or v_s.claim_token <> p_claim_token then
      raise exception 'schedule claim is not current (state=%)', v_s.state;
    end if;
    if v_s.target_kind <> 'blog_draft' or v_s.blog_draft_id <> p_draft_id then
      raise exception 'schedule does not target this draft';
    end if;
    if not p_allow_early and v_s.due_at > now() then raise exception 'schedule is not due yet'; end if;
    if v_d.revision <> v_s.source_revision then
      raise exception 'content changed since it was scheduled (revision % was reviewed, % is current)',
        v_s.source_revision, v_d.revision;
    end if;
  end if;

  if length(trim(v_d.title)) = 0 or length(trim(v_d.body)) = 0 then
    raise exception 'draft is incomplete: a title and a body are required';
  end if;
  if v_d.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'draft is incomplete: the slug must be lowercase kebab-case';
  end if;
  if exists (select 1 from public.blog_posts b where b.slug = v_d.slug) then
    raise exception 'slug conflict: % already exists (an existing post is never assumed ours)', v_d.slug;
  end if;
  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array' then
    raise exception 'images must be a JSON array';
  end if;

  for v_img in select * from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) loop
    -- The caller (lib/contentPublishing/blogDraftImages) already pinned the
    -- origin to this project's public storage; http is only the local stack.
    if v_img->>'url' is null or v_img->>'url' !~ '^https?://' then
      raise exception 'image % is not a public url', v_i;
    end if;
    if v_i = 0 then
      v_cover_url := v_img->>'url'; v_cover_alt := coalesce(v_img->>'alt', '');
    else
      v_extra_urls := v_extra_urls || (v_img->>'url');
      v_extra_alts := v_extra_alts || coalesce(v_img->>'alt', '');
    end if;
    v_i := v_i + 1;
  end loop;

  insert into public.blog_posts (
    title, body, slug, category, sites, cover_image_url, extra_image_urls,
    cover_image_alt, extra_image_alts, og_image_url,
    meta_description, meta_keywords, published_at
  ) values (
    v_d.title, v_d.body, v_d.slug, v_d.category, v_d.sites, v_cover_url, v_extra_urls,
    nullif(v_cover_alt, ''), v_extra_alts, v_cover_url,
    nullif(trim(coalesce(v_d.meta_description, '')), ''), nullif(trim(coalesce(v_d.meta_keywords, '')), ''), now()
  ) returning id into v_post_id;

  if v_cover_url is not null then
    insert into public.image_library (title, alt, image_url, source_type, source_post_id, source_post_slug, source_role, in_portfolio)
    values (v_d.title || ' cover', coalesce(nullif(v_cover_alt, ''), v_d.title), v_cover_url, 'journal', v_post_id, v_d.slug, 'cover', false)
    on conflict (source_post_id, source_role, image_url) do nothing;
  end if;
  for v_i in 1 .. coalesce(array_length(v_extra_urls, 1), 0) loop
    insert into public.image_library (title, alt, image_url, source_type, source_post_id, source_post_slug, source_role, in_portfolio)
    values (v_d.title, coalesce(nullif(v_extra_alts[v_i], ''), v_d.title), v_extra_urls[v_i], 'journal', v_post_id, v_d.slug, 'gallery', false)
    on conflict (source_post_id, source_role, image_url) do nothing;
  end loop;

  update public.blog_post_drafts
     set status = 'published', published_post_id = v_post_id, published_at = now(), updated_at = now()
   where id = p_draft_id;

  if p_schedule_id is not null then
    update public.publication_schedules
       set state = 'published', published_at = now(),
           published_target_type = 'blog_post', published_target_id = v_post_id::text,
           claim_token = null, lease_expires_at = null, next_attempt_at = null, last_error = null, updated_at = now()
     where id = p_schedule_id;
  end if;

  return jsonb_build_object('already_published', false, 'post_id', v_post_id, 'slug', v_d.slug);
end;
$$;

-- ── publication_trigger_status ──────────────────────────────────────────────
-- Safe operational read for the admin health card: whether the pg_cron job
-- exists and when it last ran. Returns nulls when pg_cron is not installed.
create or replace function public.publication_trigger_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jsonb; v_last jsonb;
begin
  if to_regclass('cron.job') is null then
    return jsonb_build_object('installed', false);
  end if;
  execute $q$ select to_jsonb(j) - 'nodename' - 'nodeport' - 'database' - 'username' - 'command'
              from cron.job j where j.jobname = 'publication-worker-tick' $q$ into v_job;
  if v_job is null then
    return jsonb_build_object('installed', true, 'scheduled', false);
  end if;
  execute $q$ select jsonb_build_object('status', d.status, 'started_at', d.start_time, 'finished_at', d.end_time,
                                        'message', left(d.return_message, 300))
              from cron.job_run_details d where d.jobid = ($1->>'jobid')::bigint
              order by d.start_time desc limit 1 $q$ into v_last using v_job;
  return jsonb_build_object('installed', true, 'scheduled', true, 'active', v_job->'active',
                            'schedule', v_job->'schedule', 'last_run', v_last);
end;
$$;

revoke all on function public.claim_publication_schedules(int, int, int) from public, anon, authenticated;
grant execute on function public.claim_publication_schedules(int, int, int) to service_role;
revoke all on function public.claim_publication_schedule_now(uuid, int, int) from public, anon, authenticated;
grant execute on function public.claim_publication_schedule_now(uuid, int, int) to service_role;
revoke all on function public.publish_scheduled_content_item(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.publish_scheduled_content_item(uuid, uuid, boolean) to service_role;
revoke all on function public.publish_blog_post_draft(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.publish_blog_post_draft(uuid, uuid, uuid, jsonb, boolean) to service_role;
revoke all on function public.publication_trigger_status() from public, anon, authenticated;
grant execute on function public.publication_trigger_status() to service_role;
