-- ROLLBACK for 20260606000003_lock_payments.sql
-- WARNING: re-opens direct anon/authenticated Data API access to payments.

alter table public.payments no force row level security;
alter table public.payments disable row level security;

grant select, insert, update, delete on public.payments to anon, authenticated;
