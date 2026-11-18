// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sessions/sync-sent-invoices
//
// Reads Gmail for invoice, contract, payment, signing and delivery evidence —
// subject heuristics, Pixieset's document notices, and an AI pass over each
// active client's conversation — then fills the inquiries timeline and advances
// client_sessions.current_status (never backward). See lib/timelineSync/.
//
// Responds with `report` (counts only) so callers can tell a clean run from a
// partial or failed one; `message` is the same outcome in words.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { runTimelineSync, TimelineSyncLoadError } from "@/lib/timelineSync/run";

export const dynamic = "force-dynamic";
// Work is bounded inside runTimelineSync (scan budget, reconcile cutoff); the
// extra headroom keeps a slow Gmail day from cutting the response off after
// the writes have already been applied.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail in Studio Dashboard first." },
      { status: 400 },
    );
  }

  try {
    const result = await runTimelineSync(
      createSupabaseAdminClient(),
      `Bearer ${tokens.access_token}`,
      tokens.email,
    );
    if (result.report.status === "failed") {
      return NextResponse.json({ error: result.message, report: result.report }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TimelineSyncLoadError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("[sync-sent-invoices] sync failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Timeline sync failed unexpectedly." }, { status: 500 });
  }
}
