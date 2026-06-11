-- Rollback for 20260611000010_payments_accuracy.sql

drop table if exists public.payments_staging;

drop index if exists public.payments_fingerprint_key;

alter table public.payments
  drop constraint if exists payments_reconciliation_status_check;

alter table public.payments
  drop column if exists fingerprint,
  drop column if exists source_txn_id,
  drop column if exists fee_cents,
  drop column if exists refund_cents,
  drop column if exists posted_at,
  drop column if exists imported_at,
  drop column if exists reconciliation_status,
  drop column if exists reconciled_at;
