import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const PAYMENTS_TABLE = "payments";
const INQUIRIES_TABLE = "inquiries";
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

// PATCH body, one of:
//   { ids, reconciliation_status } — mark payments reviewed, e.g. dismissing a
//     duplicate-suspect group sets the rows to "reconciled".
//   { ids, inquiry_id } — link payments to an inquiry (null unlinks). Only the
//     link changes: amounts, dates and status stay as recorded, so linking can
//     never add or remove revenue.
type PatchBody = { ids?: unknown; reconciliation_status?: unknown; inquiry_id?: unknown };

function parseIds(raw: unknown): number[] {
  return Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as PatchBody | null;
  const ids = parseIds(body?.ids);
  if (!ids.length || ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Provide 1-${MAX_IDS} payment ids.` }, { status: 400 });
  }
  if (body && "inquiry_id" in body) return linkInquiry(ids, body.inquiry_id);

  const status = typeof body?.reconciliation_status === "string" ? body.reconciliation_status : "";
  if (!RECONCILIATION_STATUSES.has(status)) {
    return NextResponse.json({ error: "Provide a valid reconciliation_status or inquiry_id." }, { status: 400 });
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

async function linkInquiry(ids: number[], rawInquiryId: unknown) {
  const inquiryId = rawInquiryId === null ? null : rawInquiryId;
  if (inquiryId !== null && !(Number.isInteger(inquiryId) && (inquiryId as number) > 0)) {
    return NextResponse.json({ error: "inquiry_id must be a positive integer or null." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseServerClient();
    if (inquiryId !== null) {
      const { data: inquiry, error: inquiryError } = await supabase
        .from(INQUIRIES_TABLE).select("id").eq("id", inquiryId).maybeSingle();
      if (inquiryError) throw inquiryError;
      if (!inquiry) return NextResponse.json({ error: `Inquiry #${inquiryId} not found.` }, { status: 404 });
    }
    const { error, count } = await supabase
      .from(PAYMENTS_TABLE)
      .update({ inquiry_id: inquiryId }, { count: "exact" })
      .in("id", ids);
    if (error) throw error;
    console.info(`[admin/payments] linked ${count ?? 0} payment(s) to inquiry ${inquiryId ?? "none"}`);
    return NextResponse.json({ ok: true, updated: count ?? 0 });
  } catch (err) {
    console.error("[admin/payments] link failed:", err);
    return NextResponse.json({ error: "Failed to link payments." }, { status: 500 });
  }
}
