-- Verify for 20261026000006_photo_conditions.
do $$
declare
  v_failed boolean;
  v_target bigint;
  v_source bigint;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'bay_area_locations'
      and column_name in ('light_tags','crowd_note')
  ) <> 2 then
    raise exception 'bay_area_locations is missing light_tags / crowd_note';
  end if;

  if not has_table_privilege('service_role', 'public.school_spot_conditions', 'INSERT')
     or not has_table_privilege('service_role', 'public.school_spot_conditions', 'SELECT') then
    raise exception 'service_role cannot write school_spot_conditions';
  end if;
  if has_table_privilege('anon', 'public.school_spot_conditions', 'SELECT')
     or has_table_privilege('anon', 'public.school_spot_conditions', 'INSERT') then
    raise exception 'anon must not read or write school_spot_conditions';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'school_spot_conditions'
  ) then
    raise exception 'school_spot_conditions must have RLS enabled and forced';
  end if;

  -- Spot conditions: valid rows save; empty rows and unknown tags are refused.
  insert into public.school_spot_conditions (school_slug, spot_key, light_tags, crowd_note)
  values ('uc-berkeley', 'verify-spot', array['golden-hour'], 'Busy after commencement');

  v_failed := false;
  begin
    insert into public.school_spot_conditions (school_slug, spot_key) values ('uc-berkeley', 'verify-empty');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a spot row with no condition was accepted'; end if;

  v_failed := false;
  begin
    insert into public.school_spot_conditions (school_slug, spot_key, light_tags)
    values ('uc-berkeley', 'verify-bad', array['moonlight']);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown light tag was accepted on a spot'; end if;

  delete from public.school_spot_conditions where spot_key like 'verify-%';

  -- Library locations: unknown tags and blank crowd notes are refused.
  insert into public.bay_area_locations (title, slug, region, city, description, best_for, best_time, tip, light_tags, crowd_note)
  values ('Verify target', 'verify-target', 'other', 'Nowhere', '', '', '', '', '{}', null)
  returning id into v_target;
  insert into public.bay_area_locations (title, slug, region, city, description, best_for, best_time, tip, light_tags, crowd_note)
  values ('Verify source', 'verify-source', 'other', 'Nowhere', '', '', '', '', array['overcast'], 'Weekends')
  returning id into v_source;

  v_failed := false;
  begin
    update public.bay_area_locations set light_tags = array['moonlight'] where id = v_target;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown light tag was accepted on a location'; end if;

  v_failed := false;
  begin
    update public.bay_area_locations set crowd_note = '  ' where id = v_target;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a blank crowd note was accepted'; end if;

  -- A merge fills the target's empty conditions from the source.
  perform public.merge_library_locations(v_target, v_source);
  if not exists (
    select 1 from public.bay_area_locations
    where id = v_target and light_tags = array['overcast'] and crowd_note = 'Weekends'
  ) then
    raise exception 'merge dropped the source light tags or crowd note';
  end if;

  delete from public.bay_area_locations where id in (v_target, v_source);
end $$;
