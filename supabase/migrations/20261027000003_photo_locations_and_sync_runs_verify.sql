-- Verify for 20261027000003_photo_locations_and_sync_runs.
do $$
declare
  v_failed boolean;
  v_run bigint;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'session_photos'
      and column_name in ('photo_location','photo_location_source','photo_location_confirmed_at')
  ) <> 3 then
    raise exception 'session_photos is missing photo location columns';
  end if;

  v_failed := false;
  begin
    update public.session_photos set photo_location = 'Somewhere'
    where id = (select id from public.session_photos limit 1);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed and exists (select 1 from public.session_photos) then
    raise exception 'a photo location without a source was accepted';
  end if;

  if has_table_privilege('anon', 'public.photo_sync_runs', 'SELECT') then
    raise exception 'anon must not read photo_sync_runs';
  end if;
  insert into public.photo_sync_runs (kind) values ('campus_spots') returning id into v_run;
  delete from public.photo_sync_runs where id = v_run;

  v_failed := false;
  begin
    insert into public.photo_sync_runs (kind) values ('everything');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown sync kind was accepted'; end if;
end $$;
