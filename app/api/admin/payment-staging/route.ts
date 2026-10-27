// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/payment-staging
//
// GET  — list pending staged payments (written by /api/sync-payments).
// POST — { action: "approve" | "reject", ids: number[] }
//   reject:  marks staged rows rejected.
//   approve: promotes staged rows into `payments` (fingerprint-guarded; rows
//            whose fingerprint already exists in the ledger are marked
//            duplicate instead of inserted) and applies the inquiry /
//            availability side effects that used to happen at sync time.
//            Rows that look like a transfer already in the ledger under other
//            evidence (lib/paymentMatching) stay pending and are returned in
//            `held` unless their id is listed in `confirmIds`.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { advancePortalSessionForDeposit } from "@/lib/adminPortalSessionUpsert";
import { buildBookedAvailabilityNote } from "@/lib/clientSessions";
import { findLedgerMatches } from "@/lib/paymentMatching";
import { loadNearbyLedger } from "@/lib/paymentLedgerMatches";

export const dynamic = "force-dynamic";

const STAGING_TABLE = "payments_staging";
const PAYMENTS_TABLE = "payments";
const INQUIRIES_TABLE = "inquiries";
const AVAILABILITY_TABLE = "availability";
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
    return NextResponse.json({ staged: data ?? [] });
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
  if (!body || !["approve", "reject"].includes(body.action ?? "") || !ids) {
    return NextResponse.json(
      { error: `Provide action "approve" or "reject" and 1-${MAX_IDS} staged payment ids.` },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    if (body.action === "reject") return await rejectRows(supabase, ids);
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

async function approveRows(supabase: SupabaseServerClient, ids: number[], confirmIds: Set<number>) {
  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .select(STAGING_SELECT)
    .eq("status", "pending")
    .in("id", ids);

  if (error) throw error;
  const rows = (data ?? []) as unknown as StagedRow[];

  const fingerprints = rows.map(row => row.fingerprint);
  const { data: existing, error: existingError } = await supabase
    .from(PAYMENTS_TABLE)
    .select("fingerprint")
    .in("fingerprint", fingerprints);

  if (existingError) throw existingError;
  const taken = new Set((existing ?? []).map(p => p.fingerprint as string));

  const ledger = await loadNearbyLedger(supabase, rows);

  let approved = 0;
  let skippedDuplicates = 0;
  const held: { id: number; matches: number[] }[] = [];
  const reviewedAt = new Date().toISOString();

  for (const row of rows) {
    if (taken.has(row.fingerprint)) {
      await supabase.from(STAGING_TABLE)
        .update({ status: "duplicate", reviewed_at: reviewedAt })
        .eq("id", row.id);
      skippedDuplicates++;
      continue;
    }

    const matches = findLedgerMatches({ ...row, id: -row.id }, ledger);
    if (matches.length && !confirmIds.has(row.id)) {
      held.push({ id: row.id, matches: matches.map(m => m.id) });
      continue;
    }

    const { data: inserted, error: insertError } = await supabase.from(PAYMENTS_TABLE).insert({
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
      imported_at: reviewedAt,
      reconciliation_status: "confirmed",
      reconciled_at: reviewedAt,
    }).select("id").single<{ id: number }>();

    if (insertError) {
      // Unique fingerprint race: treat as duplicate rather than failing the batch.
      console.error("[payment-staging] approve insert failed:", insertError);
      await supabase.from(STAGING_TABLE)
        .update({ status: "duplicate", reviewed_at: reviewedAt })
        .eq("id", row.id);
      skippedDuplicates++;
      continue;
    }

    taken.add(row.fingerprint);
    // Later rows in this batch must also see the payment just inserted.
    ledger.push({ ...row, id: inserted?.id ?? -row.id });
    await supabase.from(STAGING_TABLE)
      .update({ status: "approved", reviewed_at: reviewedAt })
      .eq("id", row.id);
    await applySideEffects(supabase, row, reviewedAt);
    approved++;
  }

  return NextResponse.json({ ok: true, approved, skippedDuplicates, held });
}

// Inquiry + availability + portal-session updates that previously ran inside
// the Gmail sync.
async function applySideEffects(supabase: SupabaseServerClient, row: StagedRow, now: string) {
  let inquiry: { session_type: string | null; session_date: string | null; preferred_time: string | null } | null = null;

  if (row.inquiry_id) {
    const { data } = await supabase
      .from(INQUIRIES_TABLE)
      .select("session_type, session_date, preferred_time")
      .eq("id", row.inquiry_id)
      .single<{ session_type: string | null; session_date: string | null; preferred_time: string | null }>();
    inquiry = data;

    await supabase.from(INQUIRIES_TABLE).update({
      payment_status: "paid",
      payment_note: `${row.method || "Payment"}: ${row.amount}`,
      payment_detected_at: now,
      deposit_paid_at: row.paid_at,
      booking_confirmed: true,
    }).eq("id", row.inquiry_id);
  }

  const sessionDate = row.session_date ?? inquiry?.session_date ?? null;
  if (sessionDate) {
    await supabase.from(AVAILABILITY_TABLE).upsert(
      { date: sessionDate, status: "booked", note: buildBookedAvailabilityNote(row.client_name, inquiry?.preferred_time) },
      { onConflict: "date" },
    );
  }

  // A paid deposit means the client is booked — make sure the portal reflects
  // it even when the whole booking happened over email.
  try {
    const result = await advancePortalSessionForDeposit(supabase, {
      clientEmail: row.client_email,
      clientName: row.client_name,
      sessionType: inquiry?.session_type ?? null,
      sessionDate,
    });
    if (result === "ambiguous") {
      console.error(`[payment-staging] portal session ambiguous for ${row.client_email} — left untouched`);
    }
  } catch (error) {
    console.error(`[payment-staging] portal session update failed for ${row.client_email}:`, error);
  }
}
