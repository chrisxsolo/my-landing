-- Verify for 20261026000005_school_spot_notes.
do $$
declare
  v_failed boolean;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'school_spot_notes'
      and column_name in ('school_slug','spot_key','location_note','updated_at')
  ) <> 4 then
    raise exception 'school_spot_notes is missing expected columns';
  end if;

  if not has_table_privilege('service_role', 'public.school_spot_notes', 'INSERT')
     or not has_table_privilege('service_role', 'public.school_spot_notes', 'SELECT') then
    raise exception 'service_role cannot write school_spot_notes';
  end if;
  if has_table_privilege('anon', 'public.school_spot_notes', 'SELECT')
     or has_table_privilege('anon', 'public.school_spot_notes', 'INSERT') then
    raise exception 'anon must not read or write school_spot_notes';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'school_spot_notes'
  ) then
    raise exception 'school_spot_notes must have RLS enabled and forced';
  end if;

  insert into public.school_spot_notes (school_slug, spot_key, location_note)
  values ('uc-berkeley', 'verify-spot', 'Verify note');

  v_failed := false;
  begin
    insert into public.school_spot_notes (school_slug, spot_key, location_note)
    values ('uc-berkeley', 'verify-spot', 'Second note');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a spot got two notes'; end if;

  v_failed := false;
  begin
    insert into public.school_spot_notes (school_slug, spot_key, location_note)
    values ('uc-berkeley', 'verify-blank', '   ');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a blank note was accepted'; end if;

  v_failed := false;
  begin
    insert into public.school_spot_notes (school_slug, spot_key, location_note)
    values ('ucsc', 'verify-spot', 'Note');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a school without a page was accepted'; end if;

  delete from public.school_spot_notes where spot_key like 'verify-%';
end $$;
