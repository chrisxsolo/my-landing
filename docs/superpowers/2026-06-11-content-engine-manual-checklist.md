# Content Engine — Manual Browser Checklist (spec §13.4)

Run with the local stack + `npm run dev`, signed in as admin. Production is NOT touched.

## Session list
- [ ] /admin/content-engine loads; unauthenticated visit redirects to /admin
- [ ] Blank session creates and opens the workspace
- [ ] "New from client session" lists only session_completed+ sessions; picking one
      prefills facts (first-name display name, mapped service type, date, location)
- [ ] Creating again for the same client session opens the EXISTING workspace (409 path)
- [ ] Badges + actionability sort look right; filters work

## Workspace — permissions & facts
- [ ] Generation/analyze disabled with explanation until AI processing enabled
- [ ] Publish disabled until marketing permission enabled
- [ ] Facts save; invalid school slug impossible (dropdown only)
- [ ] Revoking marketing permission with live published content opens the blocking
      modal listing counts; "Disable future publishing only" stamps revoked_at

## Photos
- [ ] Drag-drop and picker uploads work; duplicate upload of identical bytes → 409 notice
- [ ] Thumbnails render (signed URLs); exclude toggle greys the photo
- [ ] Analyze runs batch-by-batch with live progress; failures surface with Retry
- [ ] Mid-analysis reload resumes cleanly (leases)

## Background runs (content_engine_jobs)
Needs CRON_SECRET in `.env.local`, otherwise the run queues with nothing to work
it and the bar says so. Locally there is no cron, so kick the worker by hand:
`curl -X POST localhost:3000/api/content-engine/worker -H "authorization: Bearer $CRON_SECRET"`.
- [ ] "Generate everything" says what it will do, then flips to a stage line with
      a progress bar (Processing photos → Choosing photos → Writing drafts)
- [ ] Unsaved facts are committed by the run — type a location, press the button
      WITHOUT pressing Save facts, and the guide step still sees it
- [ ] Close the tab mid-run, reopen the workspace: the bar picks the same run back
      up at its current stage (it does not restart, and no second run appears)
- [ ] Press the button twice fast → "A run was already going…", one job in the DB
- [ ] Cancel run stops it at the next step; drafts already written stay as drafts
- [ ] Kill the worker mid-step (stop the dev server, restart within the lease):
      the run resumes and the bar notes it recovered
- [ ] A photo that fails analysis stops the run with a message pointing at Photos;
      Retry there, then "Run what's left" finishes it
- [ ] Nothing is ever published by a run — items land as drafts only

## Generation
- [ ] Package creation shows the pre-generation summary (photo count)
- [ ] Generate all runs in dependency order (links + testimonial BEFORE journal)
- [ ] A failed type shows Retry + Skip; skip lets the package reach ready
- [ ] Regenerate archives the package; preserve-approvals copies approved unpublished items

## Review & autosave
- [ ] Editors render per type; destination dropdowns are taxonomy-only
- [ ] Autosave: Editing… → Saving… → Saved <time>; reload restores server copy
- [ ] Two tabs editing the same item → second tab gets the comparison prompt (409)
- [ ] Save failure (kill dev server briefly) → "local backup preserved"; recovery works
- [ ] Editing an approved item reverts it to draft
- [ ] Approve / Reject (with reason) / Un-reject transitions work

## Publish & history & reconcile
- [ ] Publish approved publishes in sequence; summary shows per-item failures
- [ ] Published journal/portfolio/school/guide records appear correctly on the LOCAL site
- [ ] 409 blocked (permission off) vs 422 failed (slug conflict) surface distinctly
- [ ] Publication history lists live links; Revalidate works; Take down removes or
      deactivates the live record, preserves history, frees unshared derivatives
- [ ] Reconcile banner: stuck publishing → Mark failed; failed-with-existing → Link

## Route-level checks (4A handoff)
- [ ] All engine routes 401 without the admin cookie (curl spot-check)
- [ ] photos thumbnails stop working after ~1h (signed TTL) and recover on reload

## Production gate addenda (from the Plans 5+6 final review)
- [ ] Schedule/calendar the manual 15-month `content_events` purge (spec §3.6 —
      no cron ships with v1): `delete from content_events where viewed_at < now() - interval '15 months'`
- [ ] Note: the track-event rate limit is per-instance in-memory (30/min × instances,
      resets on cold start) — abuse dampening, not a hard global cap
- [ ] Post-deploy: confirm public derivative URLs resolve unauthenticated in prod
      (school gallery <img> uses them directly)
