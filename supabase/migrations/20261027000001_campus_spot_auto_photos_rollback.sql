-- Rollback for 20261027000001_campus_spot_auto_photos.
-- Empty campus spots go back to their placeholder; no chosen photo is affected.
drop function if exists public.claim_campus_spot_photo(text, text, text, text, text);
drop index if exists public.campus_spot_auto_photos_image_key;
drop table if exists public.campus_spot_auto_photos;
