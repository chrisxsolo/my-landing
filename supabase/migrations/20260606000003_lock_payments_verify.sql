-- VERIFICATION for payments lockdown. Do not print sensitive payment details.

-- Negative: anon cannot read payments.
begin;
set local role anon;
select count(*) as anon_payments_visible from public.payments;
rollback;

-- Negative: authenticated cannot read payments.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","email":"nobody@example.com"}';
select count(*) as authed_payments_visible from public.payments;
rollback;

-- Positive: service role can still reach the table.
-- select count(*) from public.payments;
