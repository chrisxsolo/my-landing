-- Verify for 20261027000032_photo_change_log (read-only).
do $$
begin
  if to_regclass('public.photo_change_log') is null then
    raise exception 'photo_change_log is missing';
  end if;
  if has_table_privilege('anon', 'public.photo_change_log', 'SELECT')
     or has_table_privilege('authenticated', 'public.photo_change_log', 'SELECT') then
    raise exception 'anon / authenticated must not read photo_change_log';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.photo_change_log'::regclass) then
    raise exception 'row level security is not forced on photo_change_log';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.photo_change_log'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%actor%''ai''%''system''%''manual''%'
  ) then
    raise exception 'the actor CHECK does not list ai, system and manual';
  end if;
  if (select count(*) from pg_indexes where schemaname = 'public'
        and indexname in ('photo_change_log_key_idx', 'photo_change_log_created_idx')) <> 2 then
    raise exception 'a photo_change_log index is missing';
  end if;
end $$;
