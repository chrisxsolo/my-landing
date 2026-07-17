-- Verify 20260717000001_grad_spot_photos: the publish RPC accepts guide='grad'
-- and replaces location_spots.image_url with a restore point in published_ref,
-- without regressing the caption inserts (20260707000001) or the portfolio
-- category alias fix (20260618001).
do $$
declare v_cfg text[]; v_src text;
begin
  -- Security posture is unchanged.
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

  -- grad is an accepted guide and the branch does a replace-with-restore-point.
  if v_src not like '%(''family'',''couples'',''grad'')%' then
    raise exception 'publish RPC guide check does not accept grad';
  end if;
  if v_src not like '%''replaced_image_url'', v_spot.image_url%'
     or v_src not like '%update public.location_spots%'
     or v_src not like '%''grad_spot_photo''%' then
    raise exception 'publish RPC grad branch missing replace/restore-point logic';
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

  -- The target table and column the grad branch writes actually exist.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'location_spots'
                    and column_name = 'image_url') then
    raise exception 'location_spots.image_url missing';
  end if;

  raise notice '20260717000001_grad_spot_photos verified';
end $$;
