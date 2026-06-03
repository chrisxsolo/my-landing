// POST /api/admin/record-final-payment
//
// Manually records that the final (second) deposit was received for a session.
// Inserts a deposit_2 row into the payments table so it shows in analytics.
// Idempotent — silently succeeds if deposit_2 already exists for this inquiry.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

function parseCents(amount: string): number {
  if (!amount) return 0;
  const m = amount.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!m) return 0;
  return Math.round(parseFloat(m[0].replace(",", "")) * 100);
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await req.json() as {
    inquiry_id?: number;
    client_name?: string;
    client_email?: string;
    amount?: string;
    method?: string;
  };

  const { inquiry_id, client_name, client_email, amount = "", method = "manual" } = body;

  if (!inquiry_id) {
    return NextResponse.json({ error: "inquiry_id is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Idempotent: skip if deposit_2 already recorded for this inquiry
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("inquiry_id", inquiry_id)
    .eq("payment_type", "deposit_2")
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const amountCents = parseCents(amount);
  const now = new Date().toISOString();

  const { error } = await supabase.from("payments").insert({
    inquiry_id,
    client_name: client_name ?? "",
    client_email: client_email ?? "",
    amount: amount || "0",
    amount_cents: amountCents,
    method,
    payment_type: "deposit_2",
    invoice: "",
    note: "Final payment recorded manually",
    source: "manual",
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
