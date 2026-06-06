-- VERIFICATION for inquiries lockdown. Returns one sanitized result row only.

begin;
set local role service_role;

select
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename = 'inquiries'
  ) as inquiry_policy_count,
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'inquiries'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) as public_role_grant_count,
  has_table_privilege('anon', 'public.inquiries', 'SELECT') as anon_select,
  has_table_privilege('anon', 'public.inquiries', 'INSERT') as anon_insert,
  has_table_privilege('anon', 'public.inquiries', 'UPDATE') as anon_update,
  has_table_privilege('anon', 'public.inquiries', 'DELETE') as anon_delete,
  has_table_privilege('authenticated', 'public.inquiries', 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', 'public.inquiries', 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', 'public.inquiries', 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', 'public.inquiries', 'DELETE') as authenticated_delete,
  current_user as verification_role,
  (select count(*) from public.inquiries) as service_role_inquiry_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'inquiries';

rollback;
