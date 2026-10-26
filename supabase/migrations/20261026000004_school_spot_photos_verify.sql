-- Verify for 20261026000004_school_spot_photos.
do $$
declare
  v_failed boolean;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'school_spot_photos'
      and column_name in ('id','school_slug','image_url','spot_key','is_featured','position','created_at','updated_at')
  ) <> 8 then
    raise exception 'school_spot_photos is missing expected columns';
  end if;

  if not has_table_privilege('service_role', 'public.school_spot_photos', 'INSERT')
     or not has_table_privilege('service_role', 'public.school_spot_photos', 'SELECT') then
    raise exception 'service_role cannot write school_spot_photos';
  end if;
  if has_table_privilege('anon', 'public.school_spot_photos', 'SELECT')
     or has_table_privilege('anon', 'public.school_spot_photos', 'INSERT') then
    raise exception 'anon must not read or write school_spot_photos';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'school_spot_photos'
  ) then
    raise exception 'school_spot_photos must have RLS enabled and forced';
  end if;

  insert into public.school_spot_photos (school_slug, image_url, spot_key, is_featured)
  values ('sjsu', 'https://example.com/verify-a.jpg', 'verify-spot', true);

  v_failed := false;
  begin
    insert into public.school_spot_photos (school_slug, image_url, spot_key)
    values ('sjsu', 'https://example.com/verify-a.jpg', 'other-spot');
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a photo was tagged with two spots'; end if;

  v_failed := false;
  begin
    insert into public.school_spot_photos (school_slug, image_url, spot_key, is_featured)
    values ('sjsu', 'https://example.com/verify-b.jpg', 'verify-spot', true);
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a second featured photo for one spot was accepted'; end if;

  v_failed := false;
  begin
    insert into public.school_spot_photos (school_slug, image_url, spot_key)
    values ('ucsc', 'https://example.com/verify-c.jpg', 'verify-spot');
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'a school without a page was accepted'; end if;

  delete from public.school_spot_photos where image_url like 'https://example.com/verify-%';
end $$;
