-- Verify for 20261027000033_session_location_inheritance (read-only).
do $$
declare
  n_blank int;
  n_bad_pair int;
  n_bad_source int;
begin
  -- Every included photo of a single-location session carries a location.
  select count(*) into n_blank
    from public.session_photos p
    join public.photography_sessions s on s.id = p.photography_session_id
   where p.excluded = false
     and p.photo_location is null
     and s.primary_location is not null
     and length(btrim(s.primary_location)) between 1 and 200
     and not exists (
       select 1 from unnest(coalesce(s.secondary_locations, '{}'::text[])) sec
        where btrim(sec) <> ''
     );
  if n_blank > 0 then
    raise exception '% included photo(s) of a single-location session still have no location', n_blank;
  end if;

  -- The evidence model is intact: evidence never without a location, and a
  -- session-inherited location is always a person's fact (source manual).
  select count(*) into n_bad_pair from public.session_photos
   where photo_location is null and photo_location_evidence is not null;
  if n_bad_pair > 0 then raise exception '% photo(s) carry evidence without a location', n_bad_pair; end if;

  select count(*) into n_bad_source from public.session_photos
   where photo_location_evidence = 'session' and photo_location_source is distinct from 'manual';
  if n_bad_source > 0 then raise exception '% session-inherited location(s) have a source other than manual', n_bad_source; end if;
end $$;
