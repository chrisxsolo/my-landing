-- Rollback for 20261026000003_location_library.
-- The public guide keeps working from its original columns (title, image_url,
-- active, …). Session links, photo overrides, featured picks, locks and engine
-- draft rows' library metadata are lost; engine-created rows stay as inactive
-- plain rows (delete them by hand if unwanted: origin was 'engine').
begin;
drop function if exists public.merge_library_locations(bigint, bigint);
drop table if exists public.location_photo_overrides;
drop table if exists public.location_sessions;

alter table public.photography_sessions
  drop constraint if exists photography_sessions_location_sync_status_check,
  drop column if exists location_sync_status,
  drop column if exists location_sync_message,
  drop column if exists location_synced_at;

drop index if exists public.bay_area_locations_alias_keys_idx;
drop index if exists public.bay_area_locations_location_key_key;
alter table public.bay_area_locations
  drop constraint if exists bay_area_locations_region_check,
  drop constraint if exists bay_area_locations_locked_fields_check,
  drop constraint if exists bay_area_locations_environments_check,
  drop constraint if exists bay_area_locations_origin_check,
  drop column if exists ai_error,
  drop column if exists ai_generated_at,
  drop column if exists locked_fields,
  drop column if exists featured_photo_id,
  drop column if exists featured_session_id,
  drop column if exists origin,
  drop column if exists needs_review,
  drop column if exists environments,
  drop column if exists alias_keys,
  drop column if exists location_key;
commit;
