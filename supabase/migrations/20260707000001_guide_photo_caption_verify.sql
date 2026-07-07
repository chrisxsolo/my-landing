do $$
declare v_cfg text[]; v_src text;
begin
  -- Security posture is unchanged from 20260618000001.
  if has_function_privilege('anon', 'public.publish_session_content_item(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.publish_session_content_item(uuid)', 'execute') then
    raise exception 'publish RPC executable by anon/authenticated';
  end if;
  select proconfig into v_cfg from pg_proc
   where oid = 'public.publish_session_content_item(uuid)'::regprocedure;
  if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
    raise exception 'publish RPC search_path not pinned';
  end if;

  select prosrc into v_src from pg_proc
   where oid = 'public.publish_session_content_item(uuid)'::regprocedure;

  -- Both guide inserts persist the payload caption.
  if v_src not like '%insert into public.family_location_photos (location_slug, image_url, alt_text, caption, published, sort_order)%'
     or v_src not like '%insert into public.couples_location_photos (location_slug, image_url, alt_text, caption, published, sort_order)%' then
    raise exception 'publish RPC guide_photo branches missing caption insert';
  end if;

  -- The 20260618001 portfolio alias fix is still present (this migration must
  -- never regress it).
  if v_src not like '%when ''grads'' then ''graduation''%'
     or v_src not like '%when ''families'' then ''family''%' then
    raise exception 'publish RPC missing engine->raw portfolio category resolution';
  end if;

  -- Target tables actually have the caption column the inserts rely on.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'family_location_photos'
                    and column_name = 'caption') then
    raise exception 'family_location_photos.caption missing';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'couples_location_photos'
                    and column_name = 'caption') then
    raise exception 'couples_location_photos.caption missing';
  end if;

  raise notice 'VERIFY OK: guide photo caption publishing';
end $$;
