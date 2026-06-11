do $$
declare v_cfg text[];
begin
  if has_function_privilege('anon', 'public.publish_session_content_item(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.publish_session_content_item(uuid)', 'execute') then
    raise exception 'publish RPC executable by anon/authenticated';
  end if;
  -- PUBLIC check: aclexplode on proacl must not contain grantee 0 (PUBLIC)
  if exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.publish_session_content_item(uuid)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'publish RPC executable by PUBLIC';
  end if;
  select proconfig into v_cfg from pg_proc
   where oid = 'public.publish_session_content_item(uuid)'::regprocedure;
  if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
    raise exception 'publish RPC search_path not pinned';
  end if;
  select proconfig into v_cfg from pg_proc
   where oid = 'public.create_content_package(uuid, text, text, text[], jsonb, jsonb, boolean, jsonb)'::regprocedure;
  if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
    raise exception 'create_content_package search_path not pinned';
  end if;
  raise notice 'VERIFY OK: content engine RPCs';
end $$;
