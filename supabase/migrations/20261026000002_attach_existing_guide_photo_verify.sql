-- Verify 20261026000001_attach_existing_guide_photo.sql: both functions exist,
-- and only the service role can execute them.
select p.proname,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('set_guide_photo_hero', 'attach_existing_guide_photo')
 order by p.proname;
-- expected: 2 rows, service_role true, anon false, authenticated false
