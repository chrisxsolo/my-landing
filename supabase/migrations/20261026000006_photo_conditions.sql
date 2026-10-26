-- ─────────────────────────────────────────────────────────────────────────────
-- photo_conditions — the photographer's light and crowd tags for Bay Area
-- library locations and school location guide spots (2026-10-26). Additive.
--
--   light_tags  — closed vocabulary from lib/photoConditions.ts (LIGHT_TAGS):
--                 when the light works at this place. Powers the "Light"
--                 filter on /bay-area-locations and chips on the guides.
--   crowd_note  — non-null = the place gets busy; the text says when and how
--                 to avoid it. Shown as a "Gets busy" badge, never a filter.
--
-- Both are firsthand knowledge: written from the admin only. Sync and the AI
-- profile never write them, so they need no entry in locked_fields.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.bay_area_locations
  add column if not exists light_tags text[] not null default '{}',
  add column if not exists crowd_note text;

alter table public.bay_area_locations
  drop constraint if exists bay_area_locations_light_tags_check,
  add constraint bay_area_locations_light_tags_check check (light_tags <@ array[
    'golden-hour','sunrise','overcast','midday-shade','indoor-backup'
  ]::text[]),
  drop constraint if exists bay_area_locations_crowd_note_check,
  add constraint bay_area_locations_crowd_note_check check (
    crowd_note is null or length(btrim(crowd_note)) between 1 and 160
  );

-- Spot-level conditions for the school guides (/grads/<slug>/spots). A row
-- exists only while at least one condition is set; clearing both deletes it.
create table if not exists public.school_spot_conditions (
  school_slug  text not null
    check (school_slug in ('csueb','santa-clara','sf-state','sjsu','stanford','uc-berkeley','usf')),
  spot_key     text not null
    check (spot_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(spot_key) between 2 and 80),
  light_tags   text[] not null default '{}'
    check (light_tags <@ array['golden-hour','sunrise','overcast','midday-shade','indoor-backup']::text[]),
  crowd_note   text check (crowd_note is null or length(btrim(crowd_note)) between 1 and 160),
  updated_at   timestamptz not null default now(),
  primary key (school_slug, spot_key),
  check (cardinality(light_tags) > 0 or crowd_note is not null)
);

-- Admin routes and server rendering run as service_role. The grant lives here
-- because the local test reset recreates the public schema without defaults.
revoke all on public.school_spot_conditions from anon, authenticated;
grant all on public.school_spot_conditions to service_role;
alter table public.school_spot_conditions enable row level security;
alter table public.school_spot_conditions force row level security;

-- Merging two library locations keeps the target's content and fills empty
-- fields from the source (20261026000003). Same rule for the new columns, so
-- a merge never drops the source's light tags or crowd note.
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
    light_tags = case when cardinality(t.light_tags) = 0 then s.light_tags else t.light_tags end,
    crowd_note = coalesce(t.crowd_note, s.crowd_note),
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
