-- Rollback for 20261026000004_school_spot_photos.
-- School guides fall back to the campus-spots photo for each spot; spot tags are lost.
drop index if exists public.school_spot_photos_one_featured_per_spot;
drop index if exists public.school_spot_photos_school_image_key;
drop table if exists public.school_spot_photos;
