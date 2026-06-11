do $$
declare
  v_fn text;
  v_sig text;
  v_cfg text[];
begin
  for v_fn, v_sig in
    select * from (values
      ('claim_photos_for_analysis', 'public.claim_photos_for_analysis(uuid, uuid[], int, int)'),
      ('record_analysis_batch',     'public.record_analysis_batch(uuid, jsonb)')
      -- Task 2 appends these two functions; restore the rows below once Task 2 is done:
      -- ('claim_generation_type',     'public.claim_generation_type(uuid, text, int)'),
      -- ('record_generation_result',  'public.record_generation_result(uuid, text, text, text, jsonb)')
    ) t(fn, sig)
  loop
    if to_regprocedure(v_sig) is null then
      raise exception '% missing', v_fn;
    end if;
    if has_function_privilege('anon', v_sig, 'execute')
       or has_function_privilege('authenticated', v_sig, 'execute') then
      raise exception '% executable by anon/authenticated', v_fn;
    end if;
    if exists (
      select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = v_sig::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '% executable by PUBLIC', v_fn;
    end if;
    select proconfig into v_cfg from pg_proc where oid = v_sig::regprocedure;
    if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
      raise exception '% search_path not pinned', v_fn;
    end if;
  end loop;
  raise notice 'VERIFY OK: analysis + generation RPCs';
end $$;
