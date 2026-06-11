do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid='public.school_page_photos'::regclass and contype='u') then
    raise exception 'school_page_photos unique (school_slug, session_photo_id) missing';
  end if;
  if has_table_privilege('anon','public.school_page_photos','select')
     or has_table_privilege('anon','public.school_page_photos','insert') then
    raise exception 'school_page_photos readable by anon';
  end if;
  raise notice 'VERIFY OK: school_page_photos';
end $$;
