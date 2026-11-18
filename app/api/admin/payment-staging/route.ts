// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/payment-staging
//
// GET  — list pending staged payments (written by /api/sync-payments), plus
//        `unprojected`: confirmed ledger payments whose booking was never
//        updated (an approval that only got partway).
// POST — { action: "approve" | "reject" | "repair", ids: number[] }
//   reject:  marks staged rows rejected.
//   repair:  ids are LEDGER payment ids. Re-applies the booking side effects
//            of active, inquiry-linked payments. Never writes the ledger.
//   approve: promotes staged rows into `payments` (fingerprint-guarded; rows
//            whose fingerprint already exists in the ledger are marked
//            duplicate instead of inserted) and applies the inquiry /
//            availability side effects that used to happen at sync time.
//            Rows that look like a transfer already in the ledger under other
//            evidence (lib/paymentMatching) stay pending and are returned in
//            `held` unless their id is listed in `confirmIds`.
//            `incomplete` lists rows whose payment is in the ledger but whose
//            booking updates failed; `failed` lists rows that could not be
//            written at all and are still pending.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { findLedgerMatches } from "@/lib/paymentMatching";
import { loadNearbyLedger } from "@/lib/paymentLedgerMatches";
import { projectConfirmedPayment, type ConfirmedPayment, type ProjectionStep } from "@/lib/paymentProjection";
import {
  PROJECTION_SELECT, inquiryAwaitsProjection, loadUnprojectedPayments, repairPayments,
  type LedgerProjectionRow, type UnprojectedPayment,
} from "@/lib/paymentProjectionRepair";

export const dynamic = "force-dynamic";

const STAGING_TABLE = "payments_staging";
const PAYMENTS_TABLE = "payments";
const UNIQUE_VIOLATION = "23505";
const ACTIONS = ["approve", "reject", "repair"];
const MAX_IDS = 50;

const STAGING_SELECT =
  "id,fingerprint,inquiry_id,client_name,client_email,amount,amount_cents,method," +
  "payment_type,invoice,note,source,source_txn_id,paid_at,session_date,evidence,status,created_at";

type StagedRow = {
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

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(STAGING_TABLE)
      .select(STAGING_SELECT)
      .eq("status", "pending")
      .order("paid_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    // A failed repair scan must not take the review queue down with it.
    const unprojected = await loadUnprojectedPayments(supabase).catch((scanError): UnprojectedPayment[] => {
      console.error("[payment-staging] unprojected scan failed:", scanError);
      return [];
    });
    return NextResponse.json({ staged: data ?? [], unprojected });
  } catch (err) {
    console.error("[payment-staging] GET failed:", err);
    return NextResponse.json({ error: "Failed to load staged payments." }, { status: 500 });
  }
}

function parseIds(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_IDS) return null;
  const ids = input.filter((id): id is number => Number.isInteger(id) && id > 0);
  return ids.length === input.length ? ids : null;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { action?: string; ids?: unknown; confirmIds?: unknown } | null;
  const ids = parseIds(body?.ids);
  if (!body || !ACTIONS.includes(body.action ?? "") || !ids) {
    return NextResponse.json(
      { error: `Provide action "approve", "reject" or "repair" and 1-${MAX_IDS} ids.` },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    if (body.action === "reject") return await rejectRows(supabase, ids);
    if (body.action === "repair") {
      return NextResponse.json({ ok: true, ...await repairPayments(supabase, ids, new Date().toISOString()) });
    }
    const confirmIds = new Set(Array.isArray(body.confirmIds)
      ? body.confirmIds.filter((id): id is number => Number.isInteger(id) && id > 0)
      : []);
    return await approveRows(supabase, ids, confirmIds);
  } catch (err) {
    console.error("[payment-staging] POST failed:", err);
    return NextResponse.json({ error: "Failed to update staged payments." }, { status: 500 });
  }
}

async function rejectRows(supabase: SupabaseServerClient, ids: number[]) {
  const { error, count } = await supabase
    .from(STAGING_TABLE)
    .update({ status: "rejected", reviewed_at: new Date().toISOString() }, { count: "exact" })
    .eq("status", "pending")
    .in("id", ids);

  if (error) throw error;
  return NextResponse.json({ ok: true, rejected: count ?? 0 });
}

type Incomplete = { id: number; paymentId: number | null; failed: (ProjectionStep | "staging")[] };

type ApprovalTally = {
  approved: number;
  skippedDuplicates: number;
  held: { id: number; matches: number[] }[];
  incomplete: Incomplete[];
  failed: number[];
  portalAmbiguous: number[];
};

/** Marks a staged row reviewed. False when the write failed (the row is still pending). */
async function markReviewed(supabase: SupabaseServerClient, id: number, status: "approved" | "duplicate", at: string) {
  const { error } = await supabase.from(STAGING_TABLE).update({ status, reviewed_at: at }).eq("id", id);
  if (error) console.error(`[payment-staging] could not mark staged row ${id} ${status}:`, error);
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
  return { taken: new Map(existing.map(p => [p.fingerprint, p])), nearby: await loadNearbyLedger(supabase, rows) };
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

async function approveRows(supabase: SupabaseServerClient, ids: number[], confirmIds: Set<number>) {
  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .select(STAGING_SELECT)
    .eq("status", "pending")
    .in("id", ids);

  if (error) throw error;
  const rows = (data ?? []) as unknown as StagedRow[];
  const ledger = await loadLedgerState(supabase, rows);
  const tally: ApprovalTally = { approved: 0, skippedDuplicates: 0, held: [], incomplete: [], failed: [], portalAmbiguous: [] };
  const reviewedAt = new Date().toISOString();

  for (const row of rows) {
    const already = ledger.taken.get(row.fingerprint);
    if (already) {
      await settleExisting(supabase, tally, row, already, reviewedAt);
      continue;
    }

    const matches = findLedgerMatches({ ...row, id: -row.id }, ledger.nearby);
    if (matches.length && !confirmIds.has(row.id)) {
      tally.held.push({ id: row.id, matches: matches.map(m => m.id) });
      continue;
    }

    const { data: inserted, error: insertError } = await insertLedgerRow(supabase, row, reviewedAt);
    if (insertError) {
      console.error("[payment-staging] approve insert failed:", insertError);
      if (insertError.code === UNIQUE_VIOLATION) {
        // Unique fingerprint race: another request approved it first.
        await markReviewed(supabase, row.id, "duplicate", reviewedAt);
        tally.skippedDuplicates++;
      } else {
        // Anything else is a real failure: the row stays pending for a retry.
        tally.failed.push(row.id);
      }
      continue;
    }

    const paymentId = inserted?.id ?? null;
    ledger.taken.set(row.fingerprint, { ...row, id: paymentId ?? -row.id, status: "active" });
    // Later rows in this batch must also see the payment just inserted.
    ledger.nearby.push({ ...row, id: paymentId ?? -row.id });
    const stagingOk = await markReviewed(supabase, row.id, "approved", reviewedAt);
    await applyToBooking(supabase, tally, { id: row.id, paymentId }, row, reviewedAt, stagingOk);
    tally.approved++;
  }

  return NextResponse.json({ ok: true, ...tally });
}
