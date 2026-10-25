-- Verify for 20261025000001_location_intelligence. Read-only checks; tolerant of
-- later replacements of the publish RPC (it only asserts the location_guide
-- branch is present, not the function's exact text).
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'verified_locations') then
    raise exception 'verified_locations table missing';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'location_guides') then
    raise exception 'location_guides table missing';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'session_photos'
        and column_name in ('gps_latitude', 'gps_longitude')) <> 2 then
    raise exception 'session_photos GPS columns missing';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint
      where conname = 'session_content_items_content_type_check')) not like '%location_guide%' then
    raise exception 'content_type check does not allow location_guide';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint
      where conname = 'session_content_items_published_target_type_check')) not like '%location_guide%' then
    raise exception 'published_target_type check does not allow location_guide';
  end if;
  if pg_get_functiondef('public.publish_session_content_item(uuid)'::regprocedure)
       not like '%content_type = ''location_guide''%' then
    raise exception 'publish RPC has no location_guide branch';
  end if;
  if not has_table_privilege('service_role', 'public.location_guides', 'insert')
     or not has_table_privilege('service_role', 'public.verified_locations', 'insert') then
    raise exception 'service_role cannot write the new tables';
  end if;
  if has_table_privilege('anon', 'public.verified_locations', 'select') then
    raise exception 'verified_locations must not be readable by anon';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'location_guides'
                 and policyname = 'location_guides_public_read') then
    raise exception 'location_guides public read policy missing';
  end if;
end $$;
