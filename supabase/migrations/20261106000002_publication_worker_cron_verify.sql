-- Verify for 20261106000002_publication_worker_cron (read-only).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then raise exception 'pg_cron is not installed'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then raise exception 'pg_net is not installed'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'tick_publication_worker' and p.prosecdef) then
    raise exception 'tick_publication_worker() is missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'set_publication_worker_credentials' and p.prosecdef) then
    raise exception 'set_publication_worker_credentials() is missing or not security definer';
  end if;
  if not exists (select 1 from cron.job where jobname = 'publication-worker-tick' and schedule = '* * * * *' and active) then
    raise exception 'publication-worker-tick cron job is missing or inactive';
  end if;
  if exists (select 1 from information_schema.role_routine_grants
             where routine_schema = 'public' and routine_name in ('tick_publication_worker', 'set_publication_worker_credentials')
               and grantee in ('anon', 'authenticated')) then
    raise exception 'anon/authenticated must not execute the worker credential functions';
  end if;
end $$;
