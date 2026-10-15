// POST /api/admin/record-final-payment
//
// Manually records that the final (second) deposit was received for a session.
// Inserts a deposit_2 row into the payments table so it shows in analytics.
// Idempotent — silently succeeds if deposit_2 already exists for this inquiry.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parsePositivePaymentCents } from "@/lib/paymentAmount";
import { PAYMENT_SOURCE_MANUAL } from "@/lib/paymentTotalInference";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  inquiry_id: z.number().int().positive(),
  client_name: z.string().optional().default(""),
  client_email: z.string().optional().default(""),
  method: z.string().trim().min(1).optional().default("manual"),
  amount: z.string().refine(value => parsePositivePaymentCents(value) !== null,
    "Enter a valid payment amount greater than zero."),
});

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  return recordPayment(parsed.data);
}

async function recordPayment({ inquiry_id, client_name, client_email, amount, method }: z.infer<typeof paymentSchema>) {
  const supabase = createSupabaseServerClient();

  // Idempotent: skip if deposit_2 already recorded for this inquiry
  const { data: existing, error: lookupError } = await supabase
    .from("payments")
    .select("id")
    .eq("inquiry_id", inquiry_id)
    .eq("payment_type", "deposit_2")
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("[record-final-payment] lookup failed", lookupError);
    return NextResponse.json({ error: "Could not verify existing payments." }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const amountCents = parsePositivePaymentCents(amount);
  const now = new Date().toISOString();

  const { error } = await supabase.from("payments").insert({
    inquiry_id,
    client_name: client_name ?? "",
    client_email: client_email ?? "",
    amount: amount.trim(),
    amount_cents: amountCents,
    method,
    payment_type: "deposit_2",
    invoice: "",
    note: "Final payment recorded manually",
    source: PAYMENT_SOURCE_MANUAL,
    status: "active",
    paid_at: now,
    session_date: null,
  });

  if (error) {
    console.error("[record-final-payment]", error);
    return NextResponse.json({ error: error.message ?? "Failed to record payment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
