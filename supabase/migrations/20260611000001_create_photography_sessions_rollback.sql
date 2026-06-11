-- PRE-LAUNCH ONLY (spec §14): refuses when data exists.
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.photography_sessions limit 1) then
    raise exception 'photography_sessions contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.photography_sessions;
commit;
