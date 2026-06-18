do $$
declare v_cfg text[]; v_src text; v_id bigint; v_slug text;
begin
  -- Security posture is unchanged from 20260611000008.
  if has_function_privilege('anon', 'public.publish_session_content_item(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.publish_session_content_item(uuid)', 'execute') then
    raise exception 'publish RPC executable by anon/authenticated';
  end if;
  select proconfig into v_cfg from pg_proc
   where oid = 'public.publish_session_content_item(uuid)'::regprocedure;
  if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
    raise exception 'publish RPC search_path not pinned';
  end if;

  -- The fix is present: the portfolio_pick branch resolves engine slugs.
  select prosrc into v_src from pg_proc
   where oid = 'public.publish_session_content_item(uuid)'::regprocedure;
  if v_src not like '%when ''grads'' then ''graduation''%'
     or v_src not like '%when ''families'' then ''family''%' then
    raise exception 'publish RPC missing engine->raw portfolio category resolution';
  end if;

  -- Engine slugs resolve to a real portfolio_categories row (mirrors the CASE
  -- the RPC uses). couples/portraits pass through; grads/families are aliased.
  foreach v_slug in array array['grads','families','couples','portraits'] loop
    select pc.id into v_id from public.portfolio_categories pc
     where pc.slug = case v_slug
                       when 'grads' then 'graduation'
                       when 'families' then 'family'
                       else v_slug
                     end;
    if v_id is null then
      raise exception 'engine portfolio category % does not resolve to a portfolio_categories row', v_slug;
    end if;
  end loop;

  raise notice 'VERIFY OK: portfolio category alias resolution';
end $$;
