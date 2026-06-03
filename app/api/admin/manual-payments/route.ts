import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const INQUIRIES_TABLE = "inquiries";
const PAYMENTS_TABLE = "payments";
const PAYMENT_TYPES = new Set(["deposit_1", "deposit_2", "full", "other"]);
const PAYMENT_SELECT = "id,inquiry_id,client_name,client_email,amount,amount_cents,method,payment_type,invoice,note,source,status,paid_at,session_date";

type ManualPaymentInput = {
  inquiry_id?: number | null;
  client_name?: string;
  client_email?: string;
  amount?: string;
  method?: string;
  payment_type?: string;
  invoice?: string;
  note?: string;
  paid_at?: string;
  session_date?: string | null;
};

function parseCents(amount: string): number {
  const match = amount.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0].replace(/,/g, "")) * 100);
}

function normalizeDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRow(row: ManualPaymentInput) {
  const clientName = row.client_name?.trim() ?? "";
  const amount = row.amount?.trim() ?? "";
  const paidAt = normalizeDate(row.paid_at?.trim() ?? "");
  const amountCents = parseCents(amount);
  const paymentType = PAYMENT_TYPES.has(row.payment_type ?? "") ? row.payment_type : "deposit_1";

  if (!clientName || amountCents <= 0 || !paidAt) return null;

  return {
    inquiry_id: Number.isFinite(row.inquiry_id) ? row.inquiry_id : null,
    client_name: clientName,
    client_email: row.client_email?.trim().toLowerCase() ?? "",
    amount,
    amount_cents: amountCents,
    method: row.method?.trim() || "manual",
    payment_type: paymentType,
    invoice: row.invoice?.trim() ?? "",
    note: row.note?.trim() || "Payment entered manually",
    source: "manual",
    status: "active",
    paid_at: paidAt,
    session_date: row.session_date || null,
  };
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const [inquiries, payments] = await Promise.all([
    supabase
      .from(INQUIRIES_TABLE)
      .select("id,name,email,session_type,session_date")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from(PAYMENTS_TABLE)
      .select(PAYMENT_SELECT)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  if (inquiries.error) {
    return NextResponse.json({ error: inquiries.error.message }, { status: 500 });
  }
  if (payments.error) {
    return NextResponse.json({ error: payments.error.message }, { status: 500 });
  }

  return NextResponse.json({ inquiries: inquiries.data ?? [], payments: payments.data ?? [] });
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json() as { rows?: ManualPaymentInput[] };
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 50).map(normalizeRow).filter(row => row !== null) : [];

  if (!rows.length) {
    return NextResponse.json({ error: "Add at least one payment with a client name, amount, and paid date." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from(PAYMENTS_TABLE).insert(rows).select(PAYMENT_SELECT);

  if (error) {
    console.error("[manual-payments]", error);
    return NextResponse.json({ error: error.message ?? "Failed to save payments" }, { status: 500 });
  }

  const linkedRows = (data ?? []).filter(row => row.inquiry_id && row.payment_type !== "deposit_2");
  await Promise.all(linkedRows.map(row => supabase.from(INQUIRIES_TABLE).update({
    payment_status: "paid",
    payment_note: `${row.method || "Payment"}: ${row.amount}`,
    payment_detected_at: row.paid_at,
    booking_confirmed: true,
    deposit_paid_at: row.paid_at,
  }).eq("id", row.inquiry_id)));

  return NextResponse.json({ ok: true, saved: data ?? [] });
}
