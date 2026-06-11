-- PRE-LAUNCH ONLY (spec §14).
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.session_content_items limit 1)
     or exists (select 1 from public.session_content_packages limit 1) then
    raise exception 'package/item tables contain rows — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
drop table if exists public.session_content_items;
drop table if exists public.session_content_packages;
commit;
