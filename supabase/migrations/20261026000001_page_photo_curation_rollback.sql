-- Rollback for 20261026000001_page_photo_curation.
-- Pages fall back to automatic ordering; pins, hides and hero picks are lost.
drop index if exists public.page_photo_curation_one_hero_per_page;
drop index if exists public.page_photo_curation_page_image_key;
drop table if exists public.page_photo_curation;
