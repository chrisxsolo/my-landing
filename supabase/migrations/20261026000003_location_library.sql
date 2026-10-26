-- ─────────────────────────────────────────────────────────────────────────────
-- location_library — the Bay Area location guide becomes a library fed by the
-- Content Engine (2026-10-26). Additive only: no existing column, row or photo
-- is removed or rewritten except where noted below.
--
-- Identity: bay_area_locations.location_key is the canonical place key used by
-- the whole site (lib/locations/places.ts + verified_locations; the couples /
-- family / portrait guides already key on it). One row per physical place.
-- alias_keys holds keys of places merged into this one, so sessions at a merged
-- place keep landing here instead of re-creating a duplicate draft.
--
-- Sessions ↔ locations: location_sessions. 'auto' rows come from the sync and
-- are reconciled by it; 'manual' rows come from the admin and sync never
-- touches them. excluded = an admin removed an auto match; sync keeps it as a
-- tombstone and never re-adds the session.
--
-- Photos are NOT copied or linked row-by-row: the library derives them from
-- the linked sessions' approved photos (public web copy + permission). Only
-- admin corrections live in location_photo_overrides ('include' assigns a
-- photo from a multi-location session, 'hide' removes one from this place).
--
-- locked_fields: fields the photographer edited. Sync and AI only write
-- fields NOT listed here. Existing manual rows start fully locked.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bay_area_locations
  add column if not exists location_key text
    check (location_key is null or location_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add column if not exists alias_keys text[] not null default '{}',
  add column if not exists environments text[] not null default '{}',
  add column if not exists needs_review boolean not null default false,
  add column if not exists origin text not null default 'manual',
  add column if not exists featured_session_id uuid
    references public.photography_sessions(id) on delete set null,
  add column if not exists featured_photo_id uuid
    references public.session_photos(id) on delete set null,
  add column if not exists locked_fields text[] not null default '{}',
  add column if not exists ai_generated_at timestamptz,
  add column if not exists ai_error text;

alter table public.bay_area_locations
  drop constraint if exists bay_area_locations_origin_check,
  add constraint bay_area_locations_origin_check check (origin in ('manual', 'engine')),
  drop constraint if exists bay_area_locations_environments_check,
  add constraint bay_area_locations_environments_check check (environments <@ array[
    'architecture','urban','nature','beach','garden','forest','mountains','waterfront','campus','historic'
  ]::text[]),
  drop constraint if exists bay_area_locations_locked_fields_check,
  add constraint bay_area_locations_locked_fields_check check (locked_fields <@ array[
    'title','city','neighborhood','region','description','best_for','best_time','tip','environments'
  ]::text[]),
  drop constraint if exists bay_area_locations_region_check,
  add constraint bay_area_locations_region_check check (region in (
    'san-francisco','south-bay','east-bay','peninsula','north-bay','coast','other'
  ));

create unique index if not exists bay_area_locations_location_key_key
  on public.bay_area_locations (location_key) where location_key is not null;
create index if not exists bay_area_locations_alias_keys_idx
  on public.bay_area_locations using gin (alias_keys);

-- Existing rows were written by hand: lock every editorial field so no sync or
-- AI run can overwrite them, and carry their old tags into environments.
update public.bay_area_locations
set locked_fields = array['title','city','neighborhood','region','description','best_for','best_time','tip','environments'],
    environments = coalesce((
      select array_agg(distinct env order by env) from (
        select case tag
          when 'beaches' then 'beach' when 'city' then 'urban' when 'architecture' then 'architecture'
          when 'gardens' then 'garden' when 'redwoods' then 'forest' when 'waterfront' then 'waterfront'
          when 'nature' then 'nature' end as env
        from unnest(tags) as tag
      ) mapped where env is not null
    ), '{}')
where origin = 'manual' and locked_fields = '{}';

create table if not exists public.location_sessions (
  id                     uuid primary key default gen_random_uuid(),
  location_id            bigint not null references public.bay_area_locations(id) on delete cascade,
  photography_session_id uuid not null references public.photography_sessions(id) on delete cascade,
  source                 text not null check (source in ('auto', 'manual')),
  excluded               boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint location_sessions_manual_not_excluded check (not (source = 'manual' and excluded))
);
create unique index if not exists location_sessions_location_session_key
  on public.location_sessions (location_id, photography_session_id);
create index if not exists location_sessions_session_idx
  on public.location_sessions (photography_session_id);

create table if not exists public.location_photo_overrides (
  location_id      bigint not null references public.bay_area_locations(id) on delete cascade,
  session_photo_id uuid not null references public.session_photos(id) on delete cascade,
  mode             text not null check (mode in ('include', 'hide')),
  created_at       timestamptz not null default now(),
  primary key (location_id, session_photo_id)
);

-- Per-session sync state for the admin (last run, result, reason).
alter table public.photography_sessions
  add column if not exists location_sync_status text,
  add column if not exists location_sync_message text,
  add column if not exists location_synced_at timestamptz;
alter table public.photography_sessions
  drop constraint if exists photography_sessions_location_sync_status_check,
  add constraint photography_sessions_location_sync_status_check check (
    location_sync_status is null
    or location_sync_status in ('synced', 'needs_review', 'waiting', 'error')
  );

-- Admin routes and server rendering run as service_role. Grants live here
-- because the local test reset recreates the public schema without defaults.
revoke all on public.location_sessions from anon, authenticated;
revoke all on public.location_photo_overrides from anon, authenticated;
grant all on public.location_sessions to service_role;
grant all on public.location_photo_overrides to service_role;
grant all on public.bay_area_locations to service_role;
grant usage, select on sequence public.bay_area_locations_id_seq to service_role;
alter table public.location_sessions enable row level security;
alter table public.location_sessions force row level security;
alter table public.location_photo_overrides enable row level security;
alter table public.location_photo_overrides force row level security;

-- Merge one library location into another in a single transaction: the target
-- keeps its own content (empty target fields take the source's), gains the
-- source's place key as an alias so future syncs land on the target, and
-- inherits the source's session links, photo overrides and featured picks.
-- The source row is deleted. Service-role only.
create or replace function public.merge_library_locations(p_target bigint, p_source bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.bay_area_locations%rowtype;
  s public.bay_area_locations%rowtype;
  v_links integer;
begin
  if p_target = p_source then raise exception 'cannot merge a location into itself'; end if;
  select * into t from public.bay_area_locations where id = p_target for update;
  select * into s from public.bay_area_locations where id = p_source for update;
  if t.id is null or s.id is null then raise exception 'location not found'; end if;

  update public.bay_area_locations set location_key = null where id = p_source;
  update public.bay_area_locations set
    location_key = coalesce(t.location_key, s.location_key),
    alias_keys = (
      select coalesce(array_agg(distinct k order by k), '{}') from unnest(
        t.alias_keys || s.alias_keys || array[s.location_key]
      ) as k
      where k is not null and k is distinct from coalesce(t.location_key, s.location_key)
    ),
    description = case when t.description = '' then s.description else t.description end,
    best_for = case when t.best_for = '' then s.best_for else t.best_for end,
    best_time = case when t.best_time = '' then s.best_time else t.best_time end,
    tip = case when t.tip = '' then s.tip else t.tip end,
    environments = case when cardinality(t.environments) = 0 then s.environments else t.environments end,
    image_url = coalesce(t.image_url, s.image_url),
    featured_session_id = coalesce(t.featured_session_id, s.featured_session_id),
    featured_photo_id = coalesce(t.featured_photo_id, s.featured_photo_id),
    updated_at = now()
  where id = p_target;

  insert into public.location_sessions (location_id, photography_session_id, source, excluded)
  select p_target, photography_session_id, source, excluded
  from public.location_sessions where location_id = p_source
  on conflict (location_id, photography_session_id) do nothing;
  get diagnostics v_links = row_count;

  insert into public.location_photo_overrides (location_id, session_photo_id, mode)
  select p_target, session_photo_id, mode
  from public.location_photo_overrides where location_id = p_source
  on conflict (location_id, session_photo_id) do nothing;

  delete from public.bay_area_locations where id = p_source;
  return jsonb_build_object('target', p_target, 'merged', p_source, 'moved_links', v_links);
end $$;

revoke all on function public.merge_library_locations(bigint, bigint) from public, anon, authenticated;
grant execute on function public.merge_library_locations(bigint, bigint) to service_role;
