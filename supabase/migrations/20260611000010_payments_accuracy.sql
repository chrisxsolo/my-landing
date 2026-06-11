-- Accuracy protection for public.payments:
-- fingerprints + uniqueness, reconciliation statuses, gross/fee/refund split,
-- date separation (paid/posted/imported), and a staging table so Gmail sync
-- can no longer insert directly into the ledger.

alter table public.payments
  add column if not exists fingerprint text not null default '',
  add column if not exists source_txn_id text not null default '',
  add column if not exists fee_cents integer not null default 0,
  add column if not exists refund_cents integer not null default 0,
  add column if not exists posted_at date,
  add column if not exists imported_at timestamptz not null default now(),
  add column if not exists reconciliation_status text not null default 'unreviewed',
  add column if not exists reconciled_at timestamptz;

alter table public.payments
  add constraint payments_reconciliation_status_check
  check (reconciliation_status in ('unreviewed','needs_review','confirmed','reconciled'));

-- Backfill deterministic, occurrence-aware fingerprints for legacy rows.
-- Format mirrors lib/paymentFingerprint.ts: md5('payer|cents|YYYY-MM-DD|method|occurrence')
with numbered as (
  select id,
    md5(
      lower(coalesce(nullif(client_email,''), client_name)) || '|' ||
      amount_cents::text || '|' ||
      to_char(paid_at, 'YYYY-MM-DD') || '|' ||
      lower(method) || '|' ||
      row_number() over (
        partition by lower(coalesce(nullif(client_email,''), client_name)),
                     amount_cents, paid_at::date, lower(method)
        order by id
      )::text
    ) as fp
  from public.payments
  where fingerprint = ''
)
update public.payments p set fingerprint = n.fp from numbered n where p.id = n.id;

-- The 61-row ledger was hand-reconciled on 2026-06-11.
update public.payments
set reconciliation_status = 'confirmed', reconciled_at = now()
where reconciliation_status = 'unreviewed';

create unique index if not exists payments_fingerprint_key
  on public.payments (fingerprint) where fingerprint <> '';

-- Staging: Gmail sync writes here; rows enter payments only via explicit approval.
create table if not exists public.payments_staging (
  id bigint generated always as identity primary key,
  fingerprint text not null,
  inquiry_id bigint,
  client_name text not null default '',
  client_email text not null default '',
  amount text not null default '',
  amount_cents integer not null default 0,
  method text not null default '',
  payment_type text not null default 'other',
  invoice text not null default '',
  note text not null default '',
  source text not null default 'gmail',
  source_txn_id text not null default '',
  paid_at timestamptz not null default now(),
  session_date date,
  evidence text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','duplicate')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists payments_staging_fingerprint_pending
  on public.payments_staging (fingerprint) where status = 'pending';

-- Same lockdown pattern as 20260606000003_lock_payments.sql
revoke all on public.payments_staging from anon, authenticated;
alter table public.payments_staging enable row level security;
alter table public.payments_staging force row level security;
