# Payments Accuracy Protection + Dashboard Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the payments ledger trustworthy (fingerprints, uniqueness, staged imports, reconciliation statuses, review queue) and make the dashboard explorable (search, filters, sort, CSV export, drill-down from every headline number, visible source evidence).

**Architecture:** Additive Postgres migration adds fingerprint/reconciliation columns to `payments` plus a `payments_staging` table; the Gmail sync writes to staging only, and a new admin approval API promotes staged rows into `payments` with `ON CONFLICT`-style fingerprint dedup. Pure helpers in `lib/` (fingerprint, filter/sort/CSV/duplicate detection) are unit-tested with vitest; the oversized `PaymentAnalyticsTab` is split into panels that share one filter state, making every stat card a drill-down into the transaction list.

**Tech Stack:** Next.js App Router, Supabase (service-role server client, RLS locked), TypeScript, Tailwind, vitest.

**Scope notes (decided from data inspection):**
- The live table has 61 active rows, all `source='auto'`, hand-reconciled 2026-06-11 → backfill them as `reconciliation_status='confirmed'`.
- There is one *legitimate* same-day duplicate (trang.hoang764@gmail.com, $192.50 ×2 on 2026-05-23), so the uniqueness key must be occurrence-aware, not a naive payer+amount+date constraint.
- **Out of scope (no data to support them yet):** booked-vs-collected revenue and outstanding balance (no contracted-total column on inquiries; today it's inferred by `inferPaymentTotalCents`), acquisition-source analytics (no acquisition field anywhere), month locking. These are noted as follow-ups, not silently dropped.

---

### Task 1: Migration — fingerprint, reconciliation, money split, staging table

**Files:**
- Create: `supabase/migrations/20260611000010_payments_accuracy.sql`
- Create: `supabase/migrations/20260611000010_payments_accuracy_rollback.sql`
- Create: `supabase/migrations/20260611000010_payments_accuracy_verify.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Write the rollback**

```sql
drop table if exists public.payments_staging;
drop index if exists public.payments_fingerprint_key;
alter table public.payments
  drop constraint if exists payments_reconciliation_status_check,
  drop column if exists fingerprint,
  drop column if exists source_txn_id,
  drop column if exists fee_cents,
  drop column if exists refund_cents,
  drop column if exists posted_at,
  drop column if exists imported_at,
  drop column if exists reconciliation_status,
  drop column if exists reconciled_at;
```

- [ ] **Step 3: Write the verify script**

```sql
-- All rows fingerprinted, no dupes, all legacy rows confirmed, staging locked.
select count(*) as missing_fingerprint from public.payments where fingerprint = '';
select fingerprint, count(*) from public.payments where fingerprint <> '' group by 1 having count(*) > 1;
select reconciliation_status, count(*) from public.payments group by 1;
select relrowsecurity, relforcerowsecurity from pg_class where relname = 'payments_staging';
```

- [ ] **Step 4: Apply via Supabase MCP `apply_migration` (project `dmtslzwglpezympptqls`), run verify queries** — expect 0 missing fingerprints, 0 duplicate fingerprints, 61 confirmed.

- [ ] **Step 5: Commit** `feat: payments fingerprints, reconciliation statuses, and staging table`

---

### Task 2: `lib/paymentFingerprint.ts` + tests

**Files:**
- Create: `lib/paymentFingerprint.ts`
- Test: `tests/unit/paymentFingerprint.test.ts`

- [ ] **Step 1: Write failing tests** — gmail id wins over field hash; field hash matches the SQL backfill format (assert against a precomputed md5); occurrence changes the hash; email preferred over name; case/whitespace insensitive.

- [ ] **Step 2: Implement**

```ts
import { createHash } from "crypto";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export type FingerprintInput = {
  sourceTxnId?: string;          // e.g. Gmail message id — strongest identity
  clientEmail?: string;
  clientName?: string;
  amountCents: number;
  paidAt: string;                // ISO timestamp or YYYY-MM-DD
  method?: string;
  occurrence?: number;           // nth same-looking payment that day (1-based)
};

// Must stay in sync with the SQL backfill in 20260611000010_payments_accuracy.sql:
// md5('payer|cents|YYYY-MM-DD|method|occurrence')
export function paymentFingerprint(input: FingerprintInput): string {
  if (input.sourceTxnId?.trim()) return md5(`txn|${input.sourceTxnId.trim().toLowerCase()}`);
  const payer = (input.clientEmail?.trim() || input.clientName?.trim() || "").toLowerCase();
  const day = input.paidAt.slice(0, 10);
  const method = (input.method ?? "").trim().toLowerCase();
  return md5(`${payer}|${input.amountCents}|${day}|${method}|${input.occurrence ?? 1}`);
}
```

- [ ] **Step 3: `npx vitest run tests/unit/paymentFingerprint.test.ts`** — PASS
- [ ] **Step 4: Commit** `feat: deterministic payment fingerprint helper`

---

### Task 3: `lib/paymentFilters.ts` + tests

**Files:**
- Create: `lib/paymentFilters.ts`
- Test: `tests/unit/paymentFilters.test.ts`

Pure helpers over the payment row shape the admin API returns:

```ts
export type PaymentRow = {
  id: number; inquiry_id: number | null;
  client_name: string; client_email: string;
  amount: string; amount_cents: number;
  method: string; payment_type: string; invoice: string; note: string;
  source: string; status: string;
  paid_at: string; session_date: string | null;
  fee_cents: number; refund_cents: number;
  imported_at: string | null; reconciliation_status: string;
  source_txn_id: string;
  inquiry_session_type?: string | null;
};

export type PaymentSortKey = "date" | "amount" | "client" | "imported";

export type PaymentFilterState = {
  search: string;                 // client name/email/invoice/note substring
  method: string;                 // "" = all (normalized method label)
  paymentType: string;            // "" = all
  recon: string;                  // "" = all reconciliation statuses
  minCents: number | null;
  maxCents: number | null;
  sortKey: PaymentSortKey;
  sortDir: "asc" | "desc";
};

export const DEFAULT_PAYMENT_FILTERS: PaymentFilterState;
export function normalizePaymentMethod(method: string): string;      // moved from PaymentAnalyticsTab.normMethod
export function applyPaymentFilters(rows: PaymentRow[], f: PaymentFilterState): PaymentRow[];
export function paymentsToCsv(rows: PaymentRow[]): string;           // RFC-4180 quoting, all columns above
export function findDuplicateSuspects(rows: PaymentRow[]): PaymentRow[][];
// groups of 2+ ACTIVE rows, same payer (email else name, lowercased) and same
// amount_cents, paid within 3 days of each other — surfaced, never auto-deleted
```

- [ ] **Step 1: Write failing tests** — search hits name/email/invoice/note; amount range bounds inclusive; each sort key both directions; CSV escapes quotes/commas/newlines; duplicate suspects groups the 3-day window but not 4-days-apart rows and ignores voided rows.
- [ ] **Step 2: Implement the helpers**
- [ ] **Step 3: `npx vitest run tests/unit/paymentFilters.test.ts`** — PASS
- [ ] **Step 4: Commit** `feat: payment filter, sort, csv, and duplicate-detection helpers`

---

### Task 4: Enrich `GET /api/admin/payments`

**Files:**
- Modify: `app/api/admin/payments/route.ts`

- [ ] **Step 1:** Extend the select to the new columns plus the inquiry join, and flatten `inquiry_session_type`:

```ts
const PAYMENT_SELECT =
  "id,inquiry_id,client_name,client_email,amount,amount_cents,method,payment_type," +
  "invoice,note,source,status,paid_at,session_date,fee_cents,refund_cents," +
  "imported_at,reconciliation_status,reconciled_at,source_txn_id,inquiries(session_type)";
// map rows: inquiry_session_type: row.inquiries?.session_type ?? null (drop the nested object)
```

Response also gains `lastReconciledAt` (max `reconciled_at` across rows) for the header timestamp.

- [ ] **Step 2:** `npx tsc --noEmit` (or `npm run build` later) — clean.
- [ ] **Step 3: Commit** `feat: payments API returns reconciliation and accounting fields`

---

### Task 5: Staging review API

**Files:**
- Create: `app/api/admin/payment-staging/route.ts`

- [ ] **Step 1: Implement GET** — `requireAdmin`, list `payments_staging` where `status='pending'` ordered `paid_at desc`, limit 200.

- [ ] **Step 2: Implement POST** — body `{ action: "approve" | "reject", ids: number[] }` (validate: known action, 1–50 numeric ids).
  - **reject:** set `status='rejected', reviewed_at=now()` for pending ids.
  - **approve:** for each pending staged row:
    1. Skip (mark `duplicate`) if its fingerprint already exists in `payments`.
    2. Insert into `payments` carrying fingerprint, source_txn_id, evidence→note suffix, `source: 'gmail'`, `status: 'active'`, `reconciliation_status: 'confirmed'`, `imported_at: now()`.
    3. Mark staged row `approved, reviewed_at=now()`.
    4. Side effects that used to happen at sync time now happen here: if `inquiry_id` is set, update the inquiry (`payment_status='paid'`, `payment_note`, `payment_detected_at`, `deposit_paid_at`, `booking_confirmed=true`) and upsert `availability` for `session_date` if present.
  - Return `{ ok: true, approved, skippedDuplicates, rejected }`.

- [ ] **Step 3: Commit** `feat: payment staging review API with fingerprint-guarded approval`

---

### Task 6: Gmail sync writes to staging only

**Files:**
- Modify: `app/api/sync-payments/route.ts`

- [ ] **Step 1:** Thread the Gmail message id through `fetchMessage` results so Pass 1 rows get `source_txn_id = gmail message id` and `fingerprint = paymentFingerprint({ sourceTxnId })`. Pass 2 rows (inference from threads) get field-based fingerprints.
- [ ] **Step 2:** Replace every `supabase.from("payments").insert(...)` with an insert into `payments_staging` (`status: 'pending'`, `evidence` = first ~500 chars of the source email). Dedup set = fingerprints from `payments` ∪ pending `payments_staging` (replaces the name+amount `paymentKey`). Remove the inquiry/availability mutations from sync — they move to approval (Task 5). Pass 2 rows keep `payment_type` only as a suggestion; staging defaults to review anyway, satisfying "stop inferring payment types" (nothing inferred reaches the ledger unreviewed).
- [ ] **Step 3:** Response becomes `{ staged: [...], total }`; update the header copy in `PaymentAnalyticsTab.syncSelectedPayments` to "found N payments awaiting review".
- [ ] **Step 4: Commit** `feat: gmail payment sync stages rows for review instead of direct insert`

---

### Task 7: `TransactionsPanel` — search, filters, sort, CSV, detail

**Files:**
- Create: `app/admin/payments/TransactionsPanel.tsx`
- Modify: `app/admin/PaymentAnalyticsTab.tsx` (remove inlined list + `ActionMenu`, render panel)

- [ ] **Step 1:** Move the transaction list and `ActionMenu` out of `PaymentAnalyticsTab` into `TransactionsPanel`. Props: `rows: PaymentRow[]` (already period-scoped by parent), `filters: PaymentFilterState`, `onFiltersChange`, `onReload`. Internally applies `applyPaymentFilters`.
- [ ] **Step 2:** Add the control bar: search input, payment-type select, reconciliation-status select, min/max amount inputs, sort key + direction toggle, "Export CSV" button (`paymentsToCsv` → Blob download named `payments-<period>.csv`).
- [ ] **Step 3:** Click a row → expandable detail: full note, invoice, source (`pass1/pass2/gmail/manual`), source_txn_id, paid/posted/imported dates, reconciliation status, fee/refund cents, inquiry link. This is the "visible source evidence" view.
- [ ] **Step 4: Commit** `feat: transactions panel with search, filters, sort, csv export, and detail view`

---

### Task 8: `ReviewQueuePanel` — staged rows, needs-review, duplicates

**Files:**
- Create: `app/admin/payments/ReviewQueuePanel.tsx`
- Modify: `app/admin/PaymentAnalyticsTab.tsx` (render above transactions when non-empty)

- [ ] **Step 1:** Fetch `GET /api/admin/payment-staging`; render pending rows with evidence snippet, approve/reject per row and "approve all" with confirm.
- [ ] **Step 2:** Below staged rows, render `findDuplicateSuspects(activeRows)` groups as warnings with void shortcuts (reuses existing void API).
- [ ] **Step 3:** Panel hidden entirely when there is nothing to review; parent reloads payments after any approval.
- [ ] **Step 4: Commit** `feat: payment review queue with staged imports and duplicate suspects`

---

### Task 9: Drill-down metrics + reconciliation timestamp

**Files:**
- Modify: `app/admin/PaymentAnalyticsTab.tsx`

- [ ] **Step 1:** Replace the 3 stat cards with: **Collected** (gross active), **Refunds** (sum of refunded rows in period, negative), **Net collected** (gross − fees − refunds), **Payments**, **Avg per payment**, **Avg per client** (gross ÷ unique payer emails). Every card is a `<button>` that sets the shared filter state (e.g. Refunds → status filter `refunded`) and scrolls to the transactions panel — clicking a number always reveals the exact rows that produce it.
- [ ] **Step 2:** Method bars and payment-type bars become clickable, setting `filters.method` / `filters.paymentType`. Month bars already drill into the period (kept).
- [ ] **Step 3:** Add **Revenue by service** card grouping active rows by `inquiry_session_type` (null → "Unlinked"); clicking a service filters the list via search on session type — implemented as a dedicated `sessionType` filter field.
- [ ] **Step 4:** Header shows `Last reconciled <date>` from `lastReconciledAt`.
- [ ] **Step 5: Commit** `feat: drill-down financial metrics and reconciliation timestamp`

---

### Task 10: Verification

- [ ] `npm test` — all unit tests pass
- [ ] `npm run lint` — clean
- [ ] `npm run build` — compiles
- [ ] Re-run the migration verify queries against Supabase
- [ ] Final commit of any stragglers

---

## Follow-ups (explicitly deferred)
- Booked vs. collected + outstanding balance: needs a real `contracted_total_cents` on inquiries/sessions instead of `inferPaymentTotalCents`.
- Acquisition-source analytics: needs an acquisition field captured at inquiry time.
- Month locking + immutable adjustments table; bank CSV import.
