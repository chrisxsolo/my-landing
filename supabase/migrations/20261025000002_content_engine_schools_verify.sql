-- Verify for 20261025000002_content_engine_schools.
do $$
declare
  v_failed boolean;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'content_engine_schools'
  ) then
    raise exception 'content_engine_schools table missing';
  end if;

  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'content_engine_schools'
      and column_name in ('id','slug','name','short_name','name_key','aliases','created_at')
  ) <> 7 then
    raise exception 'content_engine_schools is missing expected columns';
  end if;

  if not has_table_privilege('service_role', 'public.content_engine_schools', 'INSERT')
     or not has_table_privilege('service_role', 'public.content_engine_schools', 'SELECT') then
    raise exception 'service_role cannot write content_engine_schools';
  end if;
  if has_table_privilege('anon', 'public.content_engine_schools', 'SELECT')
     or has_table_privilege('anon', 'public.content_engine_schools', 'INSERT') then
    raise exception 'anon must not read or write content_engine_schools';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'content_engine_schools'
  ) then
    raise exception 'content_engine_schools must have RLS enabled and forced';
  end if;

  -- Behavioural checks, undone by the savepoint-style blocks below.
  insert into public.content_engine_schools (slug, name, short_name, name_key)
  values ('verify-test-school', 'Verify Test School', 'VTS', 'test verify');

  v_failed := false;
  begin
    insert into public.content_engine_schools (slug, name, name_key)
    values ('verify-test-school', 'Another Name', 'another name');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'duplicate slug was accepted'; end if;

  v_failed := false;
  begin
    insert into public.content_engine_schools (slug, name, name_key)
    values ('verify-test-school-2', 'Verify  Test School', 'test verify');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'duplicate normalized name was accepted'; end if;

  v_failed := false;
  begin
    insert into public.content_engine_schools (slug, name, name_key)
    values ('usf', 'Some Other USF', 'other some usf');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a built-in school slug was accepted'; end if;

  delete from public.content_engine_schools where slug = 'verify-test-school';
end $$;
