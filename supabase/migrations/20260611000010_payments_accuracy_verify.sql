-- Verify 20260611000010_payments_accuracy.sql
-- Expectations:
--   missing_fingerprint = 0
--   duplicate-fingerprint query returns no rows
--   reconciliation_status counts: all legacy rows 'confirmed'
--   payments_staging has rowsecurity + forcerowsecurity = true

select count(*) as missing_fingerprint
from public.payments
where fingerprint = '';

select fingerprint, count(*) as dupes
from public.payments
where fingerprint <> ''
group by fingerprint
having count(*) > 1;

select reconciliation_status, count(*)
from public.payments
group by reconciliation_status;

select relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'payments_staging';
