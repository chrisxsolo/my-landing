-- PHASE 2: lock down public.payments after admin reads move behind
-- /api/admin/payments and all payment writes use service-role routes.

revoke all on public.payments from anon, authenticated;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'payments'
  loop
    execute format('drop policy if exists %I on public.payments', policy_name);
  end loop;
end $$;

alter table public.payments enable row level security;
alter table public.payments force row level security;
-- No policies: only service_role can read/write payment rows.
