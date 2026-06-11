-- PRE-LAUNCH ONLY (spec §14).
-- Wrapped in one transaction: if the guard raises, the drop cannot commit
-- even when run without ON_ERROR_STOP.
begin;
do $$
begin
  if exists (select 1 from public.session_photos limit 1) then
    raise exception 'session_photos contains rows — use the post-launch rollback procedure (spec §14)';
  end if;
  if exists (select 1 from storage.objects where bucket_id='session-content-originals' limit 1) then
    raise exception 'session-content-originals bucket is not empty — do not drop';
  end if;
end $$;
drop table if exists public.session_photos;
commit;
-- NOTE: the 'session-content-originals' bucket cannot be deleted via SQL
-- (storage protect_buckets_delete trigger). If a true teardown is needed,
-- delete it via the Storage API / dashboard after this rollback.
