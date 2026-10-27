-- Rollback for 20261027000030_campus_not_place_cleanup.
-- Puts every deactivated campus row back to its saved active / needs_review
-- state and re-creates the session links that were removed, then drops the
-- undo table. Safe to run once; a second run finds nothing to restore.
do $$
declare r record;
begin
  if to_regclass('public.migration_undo_20261027000030') is null then
    raise notice 'nothing to roll back: migration_undo_20261027000030 is missing';
    return;
  end if;

  for r in select * from public.migration_undo_20261027000030 where kind = 'location' loop
    update public.bay_area_locations
       set active = (r.before->>'active')::boolean,
           needs_review = (r.before->>'needs_review')::boolean
     where id = r.location_id;
  end loop;

  for r in select * from public.migration_undo_20261027000030 where kind = 'link' loop
    insert into public.location_sessions (id, location_id, photography_session_id, source, excluded, created_at, updated_at)
    values (
      (r.before->>'id')::uuid, (r.before->>'location_id')::bigint, (r.before->>'photography_session_id')::uuid,
      r.before->>'source', (r.before->>'excluded')::boolean,
      (r.before->>'created_at')::timestamptz, (r.before->>'updated_at')::timestamptz
    )
    on conflict (location_id, photography_session_id) do nothing;
  end loop;
end $$;

drop table if exists public.migration_undo_20261027000030;
