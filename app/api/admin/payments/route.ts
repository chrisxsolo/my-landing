import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const PAYMENTS_TABLE = "payments";
const PAYMENT_SELECT =
  "id,inquiry_id,client_name,client_email,amount,amount_cents,method,payment_type," +
  "invoice,note,source,status,paid_at,session_date,fee_cents,refund_cents," +
  "posted_at,imported_at,reconciliation_status,reconciled_at,source_txn_id,inquiries(session_type)";

const RECONCILIATION_STATUSES = new Set(["unreviewed", "needs_review", "confirmed", "reconciled"]);
const MAX_IDS = 50;

type PaymentRowWithInquiry = Record<string, unknown> & {
  reconciled_at: string | null;
  inquiries: { session_type: string | null } | null;
};

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(PAYMENTS_TABLE)
      .select(PAYMENT_SELECT)
      .order("paid_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const rows = (data ?? []) as unknown as PaymentRowWithInquiry[];
    let lastReconciledAt: string | null = null;
    const payments = rows.map(({ inquiries, ...row }) => {
      if (row.reconciled_at && (!lastReconciledAt || row.reconciled_at > lastReconciledAt)) {
        lastReconciledAt = row.reconciled_at;
      }
      return { ...row, inquiry_session_type: inquiries?.session_type ?? null };
    });

    return NextResponse.json({ payments, lastReconciledAt });
  } catch (err) {
    console.error("[admin/payments] GET failed:", err);
    return NextResponse.json({ error: "Failed to load payments." }, { status: 500 });
  }
}

// Mark payments reviewed: e.g. dismissing a duplicate-suspect group sets the
// rows to "reconciled" so the review queue stops flagging them.
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { ids?: unknown; reconciliation_status?: string } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];
  const status = body?.reconciliation_status ?? "";

  if (!ids.length || ids.length > MAX_IDS || !RECONCILIATION_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `Provide 1-${MAX_IDS} payment ids and a valid reconciliation_status.` },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const patch = status === "reconciled"
      ? { reconciliation_status: status, reconciled_at: new Date().toISOString() }
      : { reconciliation_status: status };
    const { error, count } = await supabase
      .from(PAYMENTS_TABLE)
      .update(patch, { count: "exact" })
      .in("id", ids);

    if (error) throw error;
    return NextResponse.json({ ok: true, updated: count ?? 0 });
  } catch (err) {
    console.error("[admin/payments] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update reconciliation status." }, { status: 500 });
  }
}
