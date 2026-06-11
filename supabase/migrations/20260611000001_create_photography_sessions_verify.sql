do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and c.relname='photography_sessions'
                   and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'photography_sessions: RLS not enabled+forced';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='photography_sessions') then
    raise exception 'photography_sessions: unexpected RLS policies exist';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='one_photography_session_per_client_session') then
    raise exception 'photography_sessions: partial unique index missing';
  end if;
  if has_table_privilege('anon','public.photography_sessions','select') then
    raise exception 'photography_sessions: anon can select';
  end if;
  raise notice 'VERIFY OK: photography_sessions';
end $$;
