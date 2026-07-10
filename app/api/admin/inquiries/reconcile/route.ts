// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/inquiries/reconcile
//
// Backfill / repair action: re-derives every inquiry's reply state (status,
// needs_reply, last inbound/outbound timestamps, linked Gmail threads) from
// the actual Gmail conversation. Manually archived / not-interested inquiries
// and manual status overrides are preserved; only rows whose derived state
// changed are written. Body may narrow to one inquiry: { "inquiryId": 92 }.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getConnectedAccountEmails, reconcileInquiriesWithGmail } from "@/lib/inquiryReconcileGmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let inquiryId: number | undefined;
  try {
    const body = await req.json() as { inquiryId?: unknown };
    if (body.inquiryId !== undefined) {
      if (!Number.isSafeInteger(body.inquiryId) || Number(body.inquiryId) <= 0) {
        return NextResponse.json({ error: "inquiryId must be a positive integer." }, { status: 400 });
      }
      inquiryId = Number(body.inquiryId);
    }
  } catch {
    // Empty body — reconcile everything.
  }

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json(
      { error: "Gmail not connected. Connect Gmail in Studio Dashboard first." },
      { status: 400 },
    );
  }

  try {
    const auth = `Bearer ${tokens.access_token}`;
    const supabase = createSupabaseAdminClient();
    const connectedEmails = await getConnectedAccountEmails(auth, tokens.email);
    const summary = await reconcileInquiriesWithGmail(supabase, auth, connectedEmails, { inquiryId });

    const message = summary.updated
      ? `Reconciled ${summary.processed} inquiries — ${summary.updated} updated (${summary.statusRepaired} status change${summary.statusRepaired !== 1 ? "s" : ""}).`
      : `Reconciled ${summary.processed} inquiries — everything already matched the Gmail history.`;
    return NextResponse.json({ ...summary, message });
  } catch (error) {
    console.error("[admin/inquiries/reconcile] failed:", error);
    return NextResponse.json({ error: "Reconciliation failed." }, { status: 500 });
  }
}
