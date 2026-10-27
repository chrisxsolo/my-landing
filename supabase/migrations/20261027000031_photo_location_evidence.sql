-- What evidence backs a photo's location (2026-10-27).
--
-- session_photos.photo_location_source says WHO set the location: 'manual'
-- (the photographer typed or confirmed it) or 'gps' (an automated match from
-- the photo's own GPS). It cannot say what the value rested on, so the admin
-- could not tell a confirmed session fact from an accepted AI guess.
--
-- photo_location_evidence records that, in the owner's order of trust:
--   manual   the photographer typed it with no suggestion behind it
--   session  the session's own location facts / client correspondence
--   gps      the photo's EXIF GPS inside a verified place's radius
--   vision   AI image analysis — supporting evidence only; the sync never
--            assigns a place from it, a person has to accept it
-- Additive and backward-compatible: existing rows are backfilled from their
-- source (manual → manual, gps → gps), the column may stay null for a row an
-- older code path writes, and photo_location_source keeps its meaning.

alter table public.session_photos
  add column if not exists photo_location_evidence text
    check (photo_location_evidence is null or photo_location_evidence in ('manual','session','gps','vision'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'session_photos_photo_location_evidence_pair') then
    -- Evidence describes a location; without a location there is nothing to describe.
    alter table public.session_photos add constraint session_photos_photo_location_evidence_pair
      check (photo_location_evidence is null or photo_location is not null);
  end if;
end $$;

update public.session_photos
   set photo_location_evidence = photo_location_source
 where photo_location_source is not null
   and photo_location_evidence is null;
