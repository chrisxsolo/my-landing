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
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

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

  const body = await req.json().catch(() => null) as { action?: string; ids?: unknown } | null;
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
    return await approveRows(supabase, ids);
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

async function approveRows(supabase: SupabaseServerClient, ids: number[]) {
  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .select(STAGING_SELECT)
    .eq("status", "pending")
    .in("id", ids);

  if (error) throw error;
  const rows = (data ?? []) as StagedRow[];

  const fingerprints = rows.map(row => row.fingerprint);
  const { data: existing, error: existingError } = await supabase
    .from(PAYMENTS_TABLE)
    .select("fingerprint")
    .in("fingerprint", fingerprints);

  if (existingError) throw existingError;
  const taken = new Set((existing ?? []).map(p => p.fingerprint as string));

  let approved = 0;
  let skippedDuplicates = 0;
  const reviewedAt = new Date().toISOString();

  for (const row of rows) {
    if (taken.has(row.fingerprint)) {
      await supabase.from(STAGING_TABLE)
        .update({ status: "duplicate", reviewed_at: reviewedAt })
        .eq("id", row.id);
      skippedDuplicates++;
      continue;
    }

    const { error: insertError } = await supabase.from(PAYMENTS_TABLE).insert({
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
    });

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
    await supabase.from(STAGING_TABLE)
      .update({ status: "approved", reviewed_at: reviewedAt })
      .eq("id", row.id);
    await applySideEffects(supabase, row, reviewedAt);
    approved++;
  }

  return NextResponse.json({ ok: true, approved, skippedDuplicates });
}

// Inquiry + availability updates that previously ran inside the Gmail sync.
async function applySideEffects(supabase: SupabaseServerClient, row: StagedRow, now: string) {
  if (row.inquiry_id) {
    await supabase.from(INQUIRIES_TABLE).update({
      payment_status: "paid",
      payment_note: `${row.method || "Payment"}: ${row.amount}`,
      payment_detected_at: now,
      deposit_paid_at: row.paid_at,
      booking_confirmed: true,
    }).eq("id", row.inquiry_id);
  }

  if (row.session_date) {
    await supabase.from(AVAILABILITY_TABLE).upsert(
      { date: row.session_date, status: "booked", note: row.client_name },
      { onConflict: "date" },
    );
  }
}
