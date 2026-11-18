// Server-only: promotes staged payments into the ledger and applies them to
// their bookings. One implementation for the review queue's Approve button and
// for automatic confirmation (Sync All, Check payment), so both follow the
// same duplicate guards and report the same partial outcomes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { findLedgerMatches } from "@/lib/paymentMatching";
import { loadNearbyLedger } from "@/lib/paymentLedgerMatches";
import { projectConfirmedPayment, type ConfirmedPayment, type ProjectionStep } from "@/lib/paymentProjection";
import { PROJECTION_SELECT, inquiryAwaitsProjection, type LedgerProjectionRow } from "@/lib/paymentProjectionRepair";

export const STAGING_TABLE = "payments_staging";
const PAYMENTS_TABLE = "payments";
const UNIQUE_VIOLATION = "23505";

export const STAGING_SELECT =
  "id,fingerprint,inquiry_id,client_name,client_email,amount,amount_cents,method," +
  "payment_type,invoice,note,source,source_txn_id,paid_at,session_date,evidence,status,created_at";

export type StagedRow = {
  id: number;
  fingerprint: string;
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount: string;
  amount_cents: number;
  method: string;
  payment_type: string;
  invoice: string;
  note: string;
  source: string;
  source_txn_id: string;
  paid_at: string;
  session_date: string | null;
  evidence: string;
  status: string;
  created_at: string;
};

export type ApprovalOptions = {
  /** Staged ids the reviewer approved despite a look-alike payment in the ledger. */
  confirmIds?: ReadonlySet<number>;
};

type SupabaseServerClient = SupabaseClient;

type Incomplete = { id: number; paymentId: number | null; failed: (ProjectionStep | "staging")[] };

export type ApprovalTally = {
  approved: number;
  skippedDuplicates: number;
  held: { id: number; matches: number[] }[];
  incomplete: Incomplete[];
  failed: number[];
  portalAmbiguous: number[];
  /** Staged ids that entered the ledger in this run. */
  approvedIds: number[];
};

/** Marks a staged row reviewed. False when the write failed (the row is still pending). */
async function markReviewed(supabase: SupabaseServerClient, id: number, status: "approved" | "duplicate", at: string) {
  const { error } = await supabase.from(STAGING_TABLE).update({ status, reviewed_at: at }).eq("id", id);
  if (error) console.error(`[payment-approval] could not mark staged row ${id} ${status}:`, error);
  return !error;
}

/** Applies a confirmed payment to its booking and records anything that did not land. */
async function applyToBooking(
  supabase: SupabaseServerClient, tally: ApprovalTally,
  ref: { id: number; paymentId: number | null }, payment: ConfirmedPayment, at: string, stagingOk: boolean,
) {
  const result = await projectConfirmedPayment(supabase, payment, at);
  const failed: Incomplete["failed"] = [...(stagingOk ? [] : ["staging" as const]), ...result.failed];
  if (failed.length) tally.incomplete.push({ ...ref, failed });
  if (result.portalAmbiguous) tally.portalAmbiguous.push(ref.id);
}

type LedgerState = {
  bookingAmounts: Map<string, number[]>;
  taken: Map<string, LedgerProjectionRow>;
  nearby: Awaited<ReturnType<typeof loadNearbyLedger>>;
};

async function loadLedgerState(supabase: SupabaseServerClient, rows: StagedRow[]): Promise<LedgerState> {
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select(PROJECTION_SELECT)
    .in("fingerprint", rows.map(row => row.fingerprint));
  if (error) throw error;
  const existing = (data ?? []) as unknown as LedgerProjectionRow[];
  return {
    taken: new Map(existing.map(p => [p.fingerprint, p])),
    nearby: await loadNearbyLedger(supabase, rows),
    bookingAmounts: await loadBookingAmounts(supabase, rows),
  };
}

/**
 * The payment is in the ledger already. Normally that is a plain duplicate;
 * when an earlier approval stopped partway, the booking is still unpaid and
 * finishing its updates here is what unblocks the row.
 */
async function settleExisting(
  supabase: SupabaseServerClient, tally: ApprovalTally, row: StagedRow, already: LedgerProjectionRow, at: string,
) {
  const stagingOk = await markReviewed(supabase, row.id, "duplicate", at);
  const unfinished = already.status === "active" && !!already.inquiry_id
    && await inquiryAwaitsProjection(supabase, already.inquiry_id);
  if (unfinished) {
    await applyToBooking(supabase, tally, { id: row.id, paymentId: already.id }, already, at, stagingOk);
  } else if (!stagingOk) {
    tally.incomplete.push({ id: row.id, paymentId: already.id, failed: ["staging"] });
  }
  tally.skippedDuplicates++;
}

function insertLedgerRow(supabase: SupabaseServerClient, row: StagedRow, at: string) {
  return supabase.from(PAYMENTS_TABLE).insert({
    inquiry_id: row.inquiry_id,
    client_name: row.client_name,
    client_email: row.client_email,
    amount: row.amount,
    amount_cents: row.amount_cents,
    method: row.method,
    payment_type: row.payment_type,
    invoice: row.invoice,
    note: row.note,
    source: row.source,
    status: "active",
    paid_at: row.paid_at,
    session_date: row.session_date,
    fingerprint: row.fingerprint,
    source_txn_id: row.source_txn_id,
    imported_at: at,
    reconciliation_status: "confirmed",
    reconciled_at: at,
  }).select("id").single<{ id: number }>();
}

const bookingAmountKey = (inquiryId: number | null, cents: number) => `${inquiryId}:${cents}`;

/**
 * Active payments already recorded against these bookings, keyed by booking
 * and amount. The same transfer can be detected twice from different emails
 * days apart — outside the date window the look-alike check uses — so a
 * second payment of the same amount on one booking always needs a person.
 */
async function loadBookingAmounts(supabase: SupabaseServerClient, rows: StagedRow[]): Promise<Map<string, number[]>> {
  const amounts = new Map<string, number[]>();
  const inquiryIds = [...new Set(rows.map(r => r.inquiry_id).filter((id): id is number => id !== null))];
  if (!inquiryIds.length) return amounts;
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select("id,inquiry_id,amount_cents")
    .eq("status", "active")
    .in("inquiry_id", inquiryIds);
  if (error) throw error;
  for (const p of (data ?? []) as { id: number; inquiry_id: number; amount_cents: number }[]) {
    const key = bookingAmountKey(p.inquiry_id, p.amount_cents);
    amounts.set(key, [...(amounts.get(key) ?? []), p.id]);
  }
  return amounts;
}

/** Inserts one staged row into the ledger and applies it to its booking. */
async function approveOne(
  supabase: SupabaseServerClient, tally: ApprovalTally, ledger: LedgerState, row: StagedRow, at: string,
) {
  const { data: inserted, error: insertError } = await insertLedgerRow(supabase, row, at);
  if (insertError) {
    console.error("[payment-approval] ledger insert failed:", insertError);
    if (insertError.code === UNIQUE_VIOLATION) {
      // Unique fingerprint race: another request approved it first.
      await markReviewed(supabase, row.id, "duplicate", at);
      tally.skippedDuplicates++;
    } else {
      // Anything else is a real failure: the row stays pending for a retry.
      tally.failed.push(row.id);
    }
    return;
  }

  const paymentId = inserted?.id ?? null;
  ledger.taken.set(row.fingerprint, { ...row, id: paymentId ?? -row.id, status: "active" });
  // Later rows in this batch must also see the payment just inserted.
  ledger.nearby.push({ ...row, id: paymentId ?? -row.id });
  if (row.inquiry_id !== null && paymentId !== null) {
    const key = bookingAmountKey(row.inquiry_id, row.amount_cents);
    ledger.bookingAmounts.set(key, [...(ledger.bookingAmounts.get(key) ?? []), paymentId]);
  }
  const stagingOk = await markReviewed(supabase, row.id, "approved", at);
  await applyToBooking(supabase, tally, { id: row.id, paymentId }, row, at, stagingOk);
  tally.approved++;
  tally.approvedIds.push(row.id);
}

/** `rows` must be pending staged rows. Returns what landed and what did not. */
export async function approveStagedRows(
  supabase: SupabaseServerClient, rows: StagedRow[], options: ApprovalOptions = {},
): Promise<ApprovalTally> {
  const tally: ApprovalTally = {
    approved: 0, skippedDuplicates: 0, held: [], incomplete: [], failed: [], portalAmbiguous: [], approvedIds: [],
  };
  if (!rows.length) return tally;

  const ledger = await loadLedgerState(supabase, rows);
  const reviewedAt = new Date().toISOString();

  for (const row of rows) {
    const already = ledger.taken.get(row.fingerprint);
    if (already) {
      await settleExisting(supabase, tally, row, already, reviewedAt);
      continue;
    }

    const sameBooking = row.inquiry_id === null
      ? [] : ledger.bookingAmounts.get(bookingAmountKey(row.inquiry_id, row.amount_cents)) ?? [];
    const matchIds = [...new Set([...findLedgerMatches({ ...row, id: -row.id }, ledger.nearby).map(m => m.id), ...sameBooking])];
    if (matchIds.length && !options.confirmIds?.has(row.id)) {
      tally.held.push({ id: row.id, matches: matchIds });
      continue;
    }

    await approveOne(supabase, tally, ledger, row, reviewedAt);
  }
  return tally;
}
