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
