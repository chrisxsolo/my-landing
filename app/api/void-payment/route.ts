// POST /api/void-payment
//
// Marks a payment row as voided or refunded.
//
// Body: { paymentId: number; action: "void" | "refund" }
//
// void   — recorded in error; strikes it from analytics, and if the inquiry
//          has no other active payments reverts payment_status to "unpaid".
// refund — money was returned; keeps the row visible in analytics as negative,
//          and reverts the inquiry payment_status to "unpaid".

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json() as { paymentId?: number; action?: string };
  const { paymentId, action } = body;

  if (!paymentId || !["void", "refund"].includes(action ?? "")) {
    return NextResponse.json({ error: "paymentId and action (void|refund) are required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Fetch the payment row to get the linked inquiry id
  const { data: payment, error: fetchErr } = await supabase
    .from("payments")
    .select("id, inquiry_id, status")
    .eq("id", paymentId)
    .single();

  if (fetchErr || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status !== "active") {
    return NextResponse.json({ error: `Payment is already ${payment.status}` }, { status: 409 });
  }

  const newStatus = action === "void" ? "voided" : "refunded";

  // Mark the payment row
  const { error: updateErr } = await supabase
    .from("payments")
    .update({ status: newStatus })
    .eq("id", paymentId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // If linked to an inquiry, check whether any active payments remain
  if (payment.inquiry_id) {
    const { data: remaining } = await supabase
      .from("payments")
      .select("id")
      .eq("inquiry_id", payment.inquiry_id)
      .eq("status", "active");

    if (!remaining || remaining.length === 0) {
      // No active payments left — revert inquiry payment_status
      await supabase.from("inquiries").update({
        payment_status: "unpaid",
        payment_note: null,
        payment_detected_at: null,
        booking_confirmed: false,
        deposit_paid_at: null,
      }).eq("id", payment.inquiry_id);
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
