-- Verify for 20261026000003_location_library. Leaves no rows behind.
do $$
declare
  v_failed boolean;
  v_loc bigint;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'bay_area_locations'
      and column_name in ('location_key','alias_keys','environments','needs_review','origin',
        'featured_session_id','featured_photo_id','locked_fields','ai_generated_at','ai_error')
  ) <> 10 then
    raise exception 'bay_area_locations is missing library columns';
  end if;
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'photography_sessions'
      and column_name in ('location_sync_status','location_sync_message','location_synced_at')
  ) <> 3 then
    raise exception 'photography_sessions is missing location sync columns';
  end if;

  -- Hand-written rows must be fully locked (never overwritten by sync/AI).
  if exists (
    select 1 from public.bay_area_locations
    where origin = 'manual' and not (locked_fields @> array['description','tip','best_time'])
  ) then
    raise exception 'a manual location is not locked';
  end if;

  foreach v_failed in array array[
    has_table_privilege('anon', 'public.location_sessions', 'SELECT'),
    has_table_privilege('anon', 'public.location_photo_overrides', 'SELECT'),
    not has_table_privilege('service_role', 'public.location_sessions', 'INSERT'),
    not has_table_privilege('service_role', 'public.location_photo_overrides', 'INSERT')
  ] loop
    if v_failed then raise exception 'location library grants are wrong'; end if;
  end loop;

  if has_function_privilege('anon', 'public.merge_library_locations(bigint, bigint)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.merge_library_locations(bigint, bigint)', 'EXECUTE') then
    raise exception 'merge_library_locations grants are wrong';
  end if;

  insert into public.bay_area_locations (title, slug, region, city, description, best_for, best_time, tip, location_key, origin, active)
  values ('Verify Place', 'verify-place-zz', 'other', 'Nowhere', '', '', '', '', 'verify-place-zz', 'engine', false)
  returning id into v_loc;

  v_failed := false;
  begin
    insert into public.bay_area_locations (title, slug, region, city, description, best_for, best_time, tip, location_key, origin, active)
    values ('Verify Place 2', 'verify-place-zz-2', 'other', 'Nowhere', '', '', '', '', 'verify-place-zz', 'engine', false);
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'two rows with one location_key were accepted'; end if;

  v_failed := false;
  begin
    update public.bay_area_locations set environments = array['moon'] where id = v_loc;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown environment was accepted'; end if;

  v_failed := false;
  begin
    update public.bay_area_locations set region = 'atlantis' where id = v_loc;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown region was accepted'; end if;

  delete from public.bay_area_locations where id = v_loc;
end $$;
