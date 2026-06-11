-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.content_events limit 1) then
    raise exception 'content_events contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.content_events;
commit;
