-- A campus is not a Bay Area place.
--
-- The location sync used to split a graduation session's location text
-- ("Sather gate, doe library") into parts and, once the photographer confirmed
-- the campus as a verified location, created a bay_area_locations draft for
-- the SCHOOL (production: id 10 "UC Berkeley", origin engine, environments
-- campus) and linked the session to it. Campus spots belong to the school's
-- campus-spot guide (lib/schoolSpots); the sync now sets them aside as campus
-- evidence (lib/locationLibrary/campusEvidence.ts) and never drafts a place.
--
-- This cleans up what the old sync made: engine-made campus rows whose place
-- key or title is a configured school are DEACTIVATED (never deleted) and
-- taken out of review, and their session links are removed only when no
-- published content references the row (a published location guide for its
-- place key, a published journal post linking to its page, or a photo it is
-- the hero of). Everything changed is saved first so the rollback can put it
-- back exactly. verified_locations is left alone: the photographer confirmed
-- that row, and a confirmed classification is never overwritten here.

create table if not exists public.migration_undo_20261027000030 (
  kind         text not null check (kind in ('location', 'link')),
  location_id  bigint not null,
  before       jsonb not null,
  created_at   timestamptz not null default now()
);
revoke all on public.migration_undo_20261027000030 from anon, authenticated;
grant all on public.migration_undo_20261027000030 to service_role;
alter table public.migration_undo_20261027000030 enable row level security;
alter table public.migration_undo_20261027000030 force row level security;

do $$
declare
  -- lib/contentEngine/taxonomy.ts SCHOOL_SLUGS and lib/contentEngine/schools.ts names / short names.
  school_keys  constant text[] := array['csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf'];
  school_names constant text[] := array[
    'california state university, east bay','csu east bay','cal state east bay','csueb',
    'santa clara university','santa clara','scu',
    'san francisco state university','sf state','sfsu',
    'san jose state university','sjsu','san jose state',
    'stanford university','stanford',
    'university of california, berkeley','uc berkeley','berkeley','ucb',
    'university of san francisco','usf','usfca','usf dons'];
  r record;
  referenced boolean;
begin
  for r in
    select l.*
      from public.bay_area_locations l
     where l.origin = 'engine'
       and 'campus' = any(l.environments)
       and (l.location_key = any(school_keys) or lower(btrim(l.title)) = any(school_names))
       and (l.active or l.needs_review)
  loop
    insert into public.migration_undo_20261027000030 (kind, location_id, before)
    values ('location', r.id, jsonb_build_object('active', r.active, 'needs_review', r.needs_review));

    update public.bay_area_locations
       set active = false, needs_review = false
     where id = r.id;

    -- Session links to the row are left in place on purpose: the production
    -- apply goes through a tool that confirms every DELETE, so the one
    -- remaining link (row 10, UC Berkeley) is removed from the location
    -- library instead. The new sync never links a session to a campus row.
  end loop;
end $$;
