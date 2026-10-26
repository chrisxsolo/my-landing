-- Verify for 20261027000001_campus_spot_auto_photos.
do $$
declare
  v_failed boolean;
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'campus_spot_auto_photos'
      and column_name in ('school_slug','spot_key','image_url','evidence','evidence_detail','assigned_at')
  ) <> 6 then
    raise exception 'campus_spot_auto_photos is missing expected columns';
  end if;

  if not has_table_privilege('service_role', 'public.campus_spot_auto_photos', 'INSERT')
     or not has_table_privilege('service_role', 'public.campus_spot_auto_photos', 'SELECT') then
    raise exception 'service_role cannot write campus_spot_auto_photos';
  end if;
  if has_table_privilege('anon', 'public.campus_spot_auto_photos', 'SELECT')
     or has_table_privilege('anon', 'public.campus_spot_auto_photos', 'INSERT') then
    raise exception 'anon must not read or write campus_spot_auto_photos';
  end if;
  if has_function_privilege('anon', 'public.claim_campus_spot_photo(text, text, text, text, text)', 'EXECUTE') then
    raise exception 'anon must not claim campus spot photos';
  end if;
  if not (
    select c.relrowsecurity and c.relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'campus_spot_auto_photos'
  ) then
    raise exception 'campus_spot_auto_photos must have RLS enabled and forced';
  end if;

  if not public.claim_campus_spot_photo('sjsu', 'verify-spot', 'https://example.com/verify-a.jpg', 'text', 'verify') then
    raise exception 'an empty spot was not claimed';
  end if;
  if public.claim_campus_spot_photo('sjsu', 'verify-spot', 'https://example.com/verify-b.jpg', 'text', 'verify') then
    raise exception 'a claimed spot was overwritten';
  end if;
  if (select image_url from public.campus_spot_auto_photos where school_slug = 'sjsu' and spot_key = 'verify-spot')
     <> 'https://example.com/verify-a.jpg' then
    raise exception 'the first claim did not survive';
  end if;
  if public.claim_campus_spot_photo('sjsu', 'verify-other', 'https://example.com/verify-a.jpg', 'text', 'verify') then
    raise exception 'one photo filled two spots';
  end if;

  v_failed := false;
  begin
    perform public.claim_campus_spot_photo('sjsu', 'verify-third', 'https://example.com/verify-c.jpg', 'guess', null);
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'an unknown evidence kind was accepted'; end if;

  delete from public.campus_spot_auto_photos where image_url like 'https://example.com/verify-%';
end $$;
