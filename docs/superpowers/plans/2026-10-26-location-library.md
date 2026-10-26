# Bay Area location library from the Content Engine (2026-10-26)

## Approach

Extend what exists instead of building a parallel system:

- **Canonical identity = the place key** already used everywhere (`lib/locations/places.ts`
  gazetteer + `verified_locations`, matched by name/alias/GPS only, never by scenery).
  Couples/family/portrait guides already key on it.
- **One card per place** = a `bay_area_locations` row with a unique `location_key`.
  The public page keeps reading this table; existing manual rows are preserved and locked.
- **Sessions ↔ locations**: `location_sessions` (auto links from sync, manual links from the
  admin; an excluded auto link is a tombstone sync never re-adds).
- **Photos ↔ locations** are derived, not copied: a single-location session contributes all
  its approved photos; a multi-location session contributes only photos whose GPS is inside
  the place radius. `location_photo_overrides` (include / hide) records admin corrections.
- **Approved photo** = has a public web copy (`public_derivative_url`), not excluded, session
  has marketing permission and no revocation. Choosing a not-yet-public photo as a hero is an
  explicit admin action that builds its web copy (`ensureDerivativesForPhotos`).
- **Field-level overrides**: `locked_fields`. Admin edits lock a field; sync/AI only write
  unlocked fields; "Auto" unlocks one field.

## Sync

`syncSessionLocations(client, sessionId, { dryRun })` — deterministic, no AI, idempotent:
resolve primary + secondary location texts → places; find or create (draft) location rows
(unique key, insert-on-conflict-do-nothing); upsert auto links (never flips excluded/manual);
remove auto links that no longer match; write the session's sync status/message/time.
Unrecognized/ambiguous names → status `needs_review`, nothing guessed.

Triggers: publish route, session facts PATCH, Location panel confirm, admin Resync, and the
worker tick (backstop). New draft locations get an AI profile in `after()`; the admin can
regenerate. AI never writes a locked field and leaves a field blank when unsure.

## Surfaces

- Admin: `/admin/content-engine/locations` (also rendered in the Bay Guide tab).
- Public: `/bay-area-locations` — server-rendered, cached, region + environment + session
  type filters, sorting, related guides/journal links from real content only.
- Backfill: `scripts/locations/backfill-library.ts` (dry run by default, `--apply` to write).
