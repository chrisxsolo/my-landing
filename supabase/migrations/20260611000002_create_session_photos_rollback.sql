-- PRE-LAUNCH ONLY (spec §14).
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
delete from storage.buckets where id = 'session-content-originals';
