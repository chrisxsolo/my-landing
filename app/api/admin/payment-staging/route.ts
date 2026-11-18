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
import { STAGING_SELECT, STAGING_TABLE, approveStagedRows, type StagedRow } from "@/lib/paymentApproval";
import { loadUnprojectedPayments, repairPayments, type UnprojectedPayment } from "@/lib/paymentProjectionRepair";

export const dynamic = "force-dynamic";

const ACTIONS = ["approve", "reject", "repair"];
const MAX_IDS = 50;

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

async function approveRows(supabase: SupabaseServerClient, ids: number[], confirmIds: Set<number>) {
  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .select(STAGING_SELECT)
    .eq("status", "pending")
    .in("id", ids);

  if (error) throw error;
  const tally = await approveStagedRows(supabase, (data ?? []) as unknown as StagedRow[], { confirmIds });
  return NextResponse.json({ ok: true, ...tally });
}
