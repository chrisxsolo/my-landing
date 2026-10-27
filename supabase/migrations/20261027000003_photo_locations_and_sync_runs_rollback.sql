-- Rollback for 20261027000003_photo_locations_and_sync_runs.
-- Photos fall back to their session's location as before; photo-level
-- location confirmations and sync history are lost. No photo is unpublished.
drop table if exists public.photo_sync_runs;
alter table public.session_photos drop constraint if exists session_photos_photo_location_pair;
alter table public.session_photos
  drop column if exists photo_location_confirmed_at,
  drop column if exists photo_location_source,
  drop column if exists photo_location;
