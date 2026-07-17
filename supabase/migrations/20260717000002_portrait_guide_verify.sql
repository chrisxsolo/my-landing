-- Verify 20260717000002_portrait_guide: the portrait_location_photos table and
-- portrait-photos bucket exist with the couples-guide security model, and the
-- publish RPC accepts guide='portrait' without regressing the grad branch
-- (20260717000001), the caption inserts (20260707000001), or the portfolio
-- category alias fix (20260618001).
do $$
declare v_cfg text[]; v_src text;
begin
  -- Table exists with RLS forced and the published-only read policy.
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'portrait_location_photos') then
    raise exception 'portrait_location_photos table missing';
  end if;
  if not exists (select 1 from pg_class c
                  where c.relname = 'portrait_location_photos'
                    and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'portrait_location_photos RLS not enabled+forced';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'portrait_location_photos'
                    and policyname = 'Public read published portrait photos') then
    raise exception 'portrait_location_photos read policy missing';
  end if;

  -- Bucket exists and is public.
  if not exists (select 1 from storage.buckets where id = 'portrait-photos' and public) then
    raise exception 'portrait-photos bucket missing or not public';
  end if;

  -- Security posture of the RPC is unchanged.
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

  -- portrait is an accepted guide with its own insert branch.
  if v_src not like '%(''family'',''couples'',''portrait'',''grad'')%' then
    raise exception 'publish RPC guide check does not accept portrait';
  end if;
  if v_src not like '%insert into public.portrait_location_photos (location_slug, image_url, alt_text, caption, published, sort_order)%'
     or v_src not like '%''portrait_location_photo''%' then
    raise exception 'publish RPC portrait branch missing';
  end if;

  -- The grad branch (20260717000001) is still present.
  if v_src not like '%''replaced_image_url'', v_spot.image_url%'
     or v_src not like '%''grad_spot_photo''%' then
    raise exception 'publish RPC grad branch regressed';
  end if;

  -- Guide caption inserts (20260707000001) are still present.
  if v_src not like '%insert into public.family_location_photos (location_slug, image_url, alt_text, caption, published, sort_order)%'
     or v_src not like '%insert into public.couples_location_photos (location_slug, image_url, alt_text, caption, published, sort_order)%' then
    raise exception 'publish RPC guide_photo branches missing caption insert';
  end if;

  -- The 20260618001 portfolio alias fix is still present.
  if v_src not like '%when ''grads'' then ''graduation''%'
     or v_src not like '%when ''families'' then ''family''%' then
    raise exception 'publish RPC missing engine->raw portfolio category resolution';
  end if;

  raise notice '20260717000002_portrait_guide verified';
end $$;
