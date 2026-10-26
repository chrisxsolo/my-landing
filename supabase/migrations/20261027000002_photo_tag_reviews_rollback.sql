-- Rollback for 20261027000002_photo_tag_reviews.
-- Photos return to their computed status; "not applicable" marks, dismissed
-- suggestions and cached AI suggestions are lost. No photo or tag is affected.
drop table if exists public.photo_tag_reviews;
