do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='one_active_package_per_session') then
    raise exception 'one_active_package_per_session missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
                 and indexname='session_content_items_unique_published_target') then
    raise exception 'unique published target index missing';
  end if;
  if has_table_privilege('anon','public.session_content_items','select')
     or has_table_privilege('authenticated','public.session_content_packages','select') then
    raise exception 'engine tables readable by anon/authenticated';
  end if;
  raise notice 'VERIFY OK: packages and items';
end $$;
