import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  PAYMENT_SOURCE_MANUAL,
  inferPaymentTotalCents,
  parseLoosePaymentCents,
} from "@/lib/paymentTotalInference";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { calculatePaymentSchedule } from "@/lib/pricingCatalog";

export const dynamic = "force-dynamic";

const INQUIRIES_TABLE = "inquiries";
const PAYMENTS_TABLE = "payments";
const PAYMENT_TYPES = new Set(["deposit_1", "deposit_2", "full", "other"]);
const PAYMENT_SELECT = "id,inquiry_id,client_name,client_email,amount,amount_cents,method,payment_type,invoice,note,source,status,paid_at,session_date";
const INQUIRY_SELECT = "id,name,email,session_type,session_date,date_in_mind,message,school,location,people,payment_status,payment_note,payment_detected_at,deposit_paid_at,created_at";

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

type PaymentPlanInput = {
  action?: string;
  inquiry_id?: number | null;
  client_name?: string;
  client_email?: string;
  total_amount?: string;
  method?: string;
  paid_at?: string;
  paid?: "deposit_1" | "deposit_2" | "full";
};

type ConfirmInquiryPaidInput = {
  action?: string;
  inquiry_id?: number | null;
  client_email?: string;
  method?: string;
  amount?: string;
  paid_at?: string;
  note?: string;
};

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

function parseCents(amount: string): number {
  return parseLoosePaymentCents(amount);
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
    source: PAYMENT_SOURCE_MANUAL,
    status: "active",
    paid_at: paidAt,
    session_date: row.session_date || null,
  };
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function buildPlanRows(input: PaymentPlanInput, existingTypes: Set<string>, totalCents: number) {
  const paidAt = normalizeDate(input.paid_at?.trim() || new Date().toISOString().slice(0, 10));
  if (!paidAt) return [];

  const types = input.paid === "full" ? ["deposit_1", "deposit_2"] : [input.paid ?? "deposit_1"];
  const paymentSchedule = calculatePaymentSchedule(totalCents);
  const amounts = {
    deposit_1: paymentSchedule.retainer,
    deposit_2: paymentSchedule.remainingBalance,
  };

  return types
    .filter(type => !existingTypes.has(type))
    .map(type => ({
      inquiry_id: Number.isFinite(input.inquiry_id) ? input.inquiry_id : null,
      client_name: input.client_name?.trim() ?? "",
      client_email: input.client_email?.trim().toLowerCase() ?? "",
      amount: formatAmount(amounts[type as "deposit_1" | "deposit_2"]),
      amount_cents: amounts[type as "deposit_1" | "deposit_2"],
      method: input.method?.trim() || "manual",
      payment_type: type,
      invoice: "",
      note: `Manual ${type === "deposit_1" ? "first" : "second"} deposit from payment planner`,
      source: PAYMENT_SOURCE_MANUAL,
      status: "active",
      paid_at: paidAt,
      session_date: null,
    }));
}

async function findBestInquiryByEmail(supabase: SupabaseServerClient, email: string) {
  if (!email) return null;

  const { data } = await supabase
    .from(INQUIRIES_TABLE)
    .select(INQUIRY_SELECT)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []).find(row => inferPaymentTotalCents([], row) > 0) ?? data?.[0] ?? null;
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const [inquiries, payments] = await Promise.all([
    supabase
      .from(INQUIRIES_TABLE)
      .select(INQUIRY_SELECT)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from(PAYMENTS_TABLE)
      .select(PAYMENT_SELECT)
      .order("paid_at", { ascending: false })
      .limit(1000),
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

  const body = await req.json() as { rows?: ManualPaymentInput[] } | PaymentPlanInput | ConfirmInquiryPaidInput;

  if ("action" in body && body.action === "mark-payment-state") {
    return markPaymentState(body);
  }

  if ("action" in body && body.action === "void-client-payments") {
    return voidClientPayments(body as PaymentPlanInput);
  }

  if ("action" in body && body.action === "confirm-inquiry-paid") {
    return confirmInquiryPaid(body as ConfirmInquiryPaidInput);
  }

  const inputRows = "rows" in body && Array.isArray(body.rows) ? body.rows : [];
  const rows = inputRows.slice(0, 50).map(normalizeRow).filter(row => row !== null);

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

async function markPaymentState(input: PaymentPlanInput) {
  if (!input.client_name?.trim() || !input.client_email?.trim()) {
    return NextResponse.json({ error: "Client name and email are required." }, { status: 400 });
  }
  if (!["deposit_1", "deposit_2", "full"].includes(input.paid ?? "")) {
    return NextResponse.json({ error: "Choose first deposit, second deposit, or paid in full." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const email = input.client_email.trim().toLowerCase();
  const query = supabase
    .from(PAYMENTS_TABLE)
    .select("id,payment_type,amount,amount_cents,status")
    .eq("status", "active");
  const paymentQuery = input.inquiry_id
    ? query.or(`inquiry_id.eq.${input.inquiry_id},client_email.eq.${email}`)
    : query.eq("client_email", email);

  const [{ data: existingPayments, error: existingError }, { data: inquiry }] = await Promise.all([
    paymentQuery,
    input.inquiry_id
      ? supabase.from(INQUIRIES_TABLE).select(INQUIRY_SELECT).eq("id", input.inquiry_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const sameEmailInquiry = inquiry ?? await findBestInquiryByEmail(supabase, email);
  const totalCents = parseCents(input.total_amount ?? "") || inferPaymentTotalCents(existingPayments ?? [], sameEmailInquiry);
  if (totalCents <= 0) {
    return NextResponse.json({ error: "Enter a total amount first." }, { status: 400 });
  }

  const existingTypes = new Set((existingPayments ?? []).map(payment => payment.payment_type).filter(Boolean) as string[]);
  const rows = buildPlanRows(input, existingTypes, totalCents);

  if (!rows.length) {
    return NextResponse.json({ ok: true, saved: [], skipped: true });
  }

  const { data, error } = await supabase.from(PAYMENTS_TABLE).insert(rows).select(PAYMENT_SELECT);

  if (error) {
    console.error("[manual-payment-state]", error);
    return NextResponse.json({ error: error.message ?? "Failed to update payment state" }, { status: 500 });
  }

  if (input.inquiry_id) {
    await supabase.from(INQUIRIES_TABLE).update({
      payment_status: "paid",
      payment_note: `Manual total ${formatAmount(totalCents)} (${input.paid === "full" ? "paid in full" : input.paid})`,
      payment_detected_at: rows[0].paid_at,
      booking_confirmed: true,
      deposit_paid_at: rows[0].paid_at,
    }).eq("id", input.inquiry_id);
  }

  return NextResponse.json({ ok: true, saved: data ?? [] });
}

// Admin override from the conversation view: mark an inquiry paid even when
// the Gmail/Claude scan fails. Records a manual ledger row when an amount is
// given (skipped if an active payment already exists — no duplicates) and
// stamps the inquiry with a clearly-labeled "Manually confirmed" note.
async function confirmInquiryPaid(input: ConfirmInquiryPaidInput) {
  const inquiryId = Number(input.inquiry_id);
  const method = input.method?.trim();
  if (!Number.isFinite(inquiryId) || !method) {
    return NextResponse.json({ error: "inquiry_id and method are required." }, { status: 400 });
  }

  const paidAt = normalizeDate(input.paid_at?.trim() || new Date().toISOString().slice(0, 10));
  if (!paidAt) {
    return NextResponse.json({ error: "paid_at must be a YYYY-MM-DD date." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: inquiry, error: inquiryError } = await supabase
    .from(INQUIRIES_TABLE).select(INQUIRY_SELECT).eq("id", inquiryId).maybeSingle();
  if (inquiryError) {
    console.error("[confirm-inquiry-paid] inquiry lookup failed:", inquiryError);
    return NextResponse.json({ error: inquiryError.message }, { status: 500 });
  }
  if (!inquiry) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });

  const amountCents = input.amount?.trim() ? parseCents(input.amount) : 0;
  const displayAmount = amountCents > 0 ? `$${formatAmount(amountCents)}` : null;

  let ledger_recorded = false;
  if (amountCents > 0) {
    const { data: existing, error: existingError } = await supabase
      .from(PAYMENTS_TABLE)
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("status", "active")
      .limit(1);
    if (existingError) {
      console.error("[confirm-inquiry-paid] payment lookup failed:", existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing?.length) {
      const { error: insertError } = await supabase.from(PAYMENTS_TABLE).insert({
        inquiry_id: inquiryId,
        client_name: inquiry.name,
        client_email: (input.client_email ?? inquiry.email ?? "").trim().toLowerCase(),
        amount: displayAmount,
        amount_cents: amountCents,
        method,
        payment_type: "deposit_1",
        invoice: "",
        note: input.note?.trim() || "Manually confirmed from conversation view",
        source: PAYMENT_SOURCE_MANUAL,
        status: "active",
        paid_at: paidAt,
        session_date: inquiry.session_date ?? null,
      });
      if (insertError) {
        console.error("[confirm-inquiry-paid] ledger insert failed:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      ledger_recorded = true;
    }
  }

  const paymentNote = ["Manually confirmed", displayAmount, `via ${method}`, input.note?.trim()]
    .filter(Boolean)
    .join(" · ");

  const { error: updateError } = await supabase.from(INQUIRIES_TABLE).update({
    payment_status: "paid",
    payment_note: paymentNote,
    payment_detected_at: paidAt,
    deposit_paid_at: paidAt,
    booking_confirmed: true,
  }).eq("id", inquiryId);
  if (updateError) {
    console.error("[confirm-inquiry-paid] inquiry update failed:", updateError);
    return NextResponse.json(
      { error: "Payment was recorded but the inquiry could not be updated." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    ledger_recorded,
    already_paid: inquiry.payment_status === "paid",
    payment_note: paymentNote,
  });
}

async function voidClientPayments(input: PaymentPlanInput) {
  if (!input.inquiry_id && !input.client_email) {
    return NextResponse.json({ error: "inquiry_id or client_email required." }, { status: 400 });
  }
  const supabase = createSupabaseServerClient();
  const { error } = input.inquiry_id
    ? await supabase.from(PAYMENTS_TABLE).update({ status: "voided" }).eq("status", "active").eq("inquiry_id", input.inquiry_id)
    : await supabase.from(PAYMENTS_TABLE).update({ status: "voided" }).eq("status", "active").eq("client_email", input.client_email!.trim().toLowerCase());
  if (error) {
    console.error("[void-client-payments]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
