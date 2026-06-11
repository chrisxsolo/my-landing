-- PRE-LAUNCH ONLY (spec §14): refuses when data exists.
do $$
begin
  if exists (select 1 from public.photography_sessions limit 1) then
    raise exception 'photography_sessions contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.photography_sessions;
