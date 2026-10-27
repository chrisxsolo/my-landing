-- Verify for 20261027000031_photo_location_evidence (read-only).
do $$
declare
  n_unfilled int;
  n_orphan int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'session_photos' and column_name = 'photo_location_evidence'
  ) then
    raise exception 'session_photos.photo_location_evidence is missing';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_photos_photo_location_evidence_pair') then
    raise exception 'session_photos_photo_location_evidence_pair is missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_photos'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%photo_location_evidence%''manual''%''session''%''gps''%''vision''%'
  ) then
    raise exception 'the photo_location_evidence CHECK does not list manual, session, gps and vision';
  end if;

  -- Every located photo that already had a source carries evidence (the backfill ran).
  select count(*) into n_unfilled from public.session_photos
   where photo_location_source is not null and photo_location_evidence is null;
  if n_unfilled > 0 then raise exception '% located photo(s) have no evidence level', n_unfilled; end if;

  select count(*) into n_orphan from public.session_photos
   where photo_location is null and photo_location_evidence is not null;
  if n_orphan > 0 then raise exception '% photo(s) carry evidence without a location', n_orphan; end if;
end $$;
