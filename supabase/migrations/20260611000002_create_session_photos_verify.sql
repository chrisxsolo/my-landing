do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and c.relname='session_photos'
                   and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'session_photos: RLS not enabled+forced';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid='public.session_photos'::regclass and contype='u') then
    raise exception 'session_photos: unique (session, content_hash) missing';
  end if;
  if not exists (select 1 from storage.buckets
                 where id='session-content-originals' and public=false) then
    raise exception 'session-content-originals bucket missing or public';
  end if;
  if has_table_privilege('anon','public.session_photos','select') then
    raise exception 'session_photos: anon can select';
  end if;
  raise notice 'VERIFY OK: session_photos';
end $$;
