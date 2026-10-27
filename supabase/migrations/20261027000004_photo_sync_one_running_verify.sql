-- Verify for 20261027000004_photo_sync_one_running.
do $$
declare
  v_first bigint;
  v_refused boolean := false;
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'photo_sync_runs_one_running_idx'
  ) then
    raise exception 'photo_sync_runs_one_running_idx is missing';
  end if;

  insert into public.photo_sync_runs (kind, scope) values ('campus_spots', '00000000-0000-0000-0000-000000000000') returning id into v_first;
  begin
    insert into public.photo_sync_runs (kind, scope) values ('campus_spots', '00000000-0000-0000-0000-000000000000');
  exception when unique_violation then v_refused := true;
  end;
  delete from public.photo_sync_runs where id = v_first;
  if not v_refused then
    raise exception 'a second running campus_spots sync was accepted';
  end if;
end $$;
