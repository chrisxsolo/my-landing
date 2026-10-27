-- Rollback for 20261027000031_photo_location_evidence.
-- Drops the evidence column; photo_location and photo_location_source are
-- untouched, so every photo keeps its location and who set it.
alter table public.session_photos
  drop constraint if exists session_photos_photo_location_evidence_pair;
alter table public.session_photos
  drop column if exists photo_location_evidence;
