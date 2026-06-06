-- PHASE 2: lock down public.inquiries after all browser admin access moved
-- behind /api/admin/inquiries. Public contact submissions use /api/contact
-- with the server-side service-role client.

revoke all on public.inquiries from anon, authenticated;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'inquiries'
  loop
    execute format('drop policy if exists %I on public.inquiries', policy_name);
  end loop;
end $$;

alter table public.inquiries enable row level security;
alter table public.inquiries force row level security;
-- No policies: service_role retains access through PostgreSQL BYPASSRLS.
