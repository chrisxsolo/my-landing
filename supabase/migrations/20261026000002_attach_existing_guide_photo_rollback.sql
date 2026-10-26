-- Rollback for 20261026000001_attach_existing_guide_photo.sql.
-- Gallery rows created through these functions are ordinary rows and stay.
drop function if exists public.attach_existing_guide_photo(text, text, uuid, boolean, boolean);
drop function if exists public.set_guide_photo_hero(text, text, uuid);
