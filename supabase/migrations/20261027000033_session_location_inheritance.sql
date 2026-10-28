-- Session-location inheritance backfill (2026-10-27).
--
-- A Content Engine session whose facts name exactly ONE location — a
-- non-empty primary_location and no non-empty secondary location — is an
-- explicit single-location shoot. Its photos used to sit in the review queue
-- as "missing location", each asking the photographer to approve that same
-- fact (the UC Law session: nine Palace of Fine Arts cards). From now on the
-- server fills them (lib/photoTagging/inheritLocation) when facts are saved
-- and when a photo is uploaded; this repairs the sessions that already exist.
--
-- Exactly what accepting the session-location suggestion writes:
--   photo_location           the trimmed primary location
--   photo_location_source    'manual'   (who confirmed it: a person's fact)
--   photo_location_evidence  'session'  (what it rests on: the session's facts)
--   photo_location_confirmed_at now()
-- Only INCLUDED photos with NO stored location are touched: a manual, GPS or
-- accepted-vision location is a fact about that photo and is never
-- overwritten. Every row written is recorded in photo_change_log as a
-- 'system' change (restorable from the history like any other).
-- Idempotent: a filled photo no longer matches the WHERE clause.
-- Alias canonicalization ("palace of fine arts" → "Palace of Fine Arts") is
-- the application's place matcher's job; the next Session facts save
-- updates these session-evidence rows to the canonical name when they differ.

with eligible as (
  select p.id, btrim(s.primary_location) as location
    from public.session_photos p
    join public.photography_sessions s on s.id = p.photography_session_id
   where p.excluded = false
     and p.photo_location is null
     and s.primary_location is not null
     and length(btrim(s.primary_location)) between 1 and 200
     and not exists (
       select 1 from unnest(coalesce(s.secondary_locations, '{}'::text[])) sec
        where btrim(sec) <> ''
     )
), filled as (
  update public.session_photos p
     set photo_location = e.location,
         photo_location_source = 'manual',
         photo_location_evidence = 'session',
         photo_location_confirmed_at = now()
    from eligible e
   where p.id = e.id
  returning p.id, e.location
)
insert into public.photo_change_log (photo_key, field, old_value, new_value, actor, reason)
select 'engine:' || f.id, 'location', null, to_jsonb(f.location), 'system', 'backfill: inherited the session''s only location'
  from filled f;
