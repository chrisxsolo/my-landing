-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.testimonials where photography_session_id is not null limit 1) then
    raise exception 'testimonials rows reference photography_sessions — use the post-launch rollback procedure (spec §14)';
  end if;
end $$;
alter table public.testimonials drop column if exists photography_session_id;
commit;
