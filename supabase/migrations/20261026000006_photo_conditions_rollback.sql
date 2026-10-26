-- Rollback for 20261026000006_photo_conditions.
-- Light tags and crowd notes are lost; the Light filter and the guide chips
-- disappear. Restores the merge function from 20261026000003 first, because
-- the 000006 version references the columns dropped below.
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

drop table if exists public.school_spot_conditions;

alter table public.bay_area_locations
  drop constraint if exists bay_area_locations_light_tags_check,
  drop constraint if exists bay_area_locations_crowd_note_check,
  drop column if exists light_tags,
  drop column if exists crowd_note;
