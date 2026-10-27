// When /api/check-payment marks an inquiry paid, the money must also enter the
// revenue pipeline — otherwise the client reads "Paid" while revenue reads $0.
// It goes to payments_staging (not the ledger) because the evidence is an AI
// judgment over email; approval in the review queue is the human check.

import type { createSupabaseServerClient } from "@/lib/supabaseServer";
import { parsePositivePaymentCents } from "@/lib/paymentAmount";
import { paymentFingerprint } from "@/lib/paymentFingerprint";

const STAGING_TABLE = "payments_staging";
const PAYMENTS_TABLE = "payments";
// Must be a value allowed by payments_source_check, since approval copies it.
const CHECK_PAYMENT_SOURCE = "auto";
const EVIDENCE_MAX_CHARS = 500;

export type LedgerStagingOutcome = "staged" | "already_recorded" | "no_amount" | "failed";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

export type DetectedPayment = {
  inquiryId: number;
  clientName: string;
  clientEmail: string;
  amount: string | null;
  method: string | null;
  note: string;
  sessionDate: string | null;
  evidence: string;
  detectedAt: string;
};

async function hasMatchingPayment(supabase: SupabaseServerClient, inquiryId: number, cents: number) {
  const [ledger, staged] = await Promise.all([
    supabase.from(PAYMENTS_TABLE).select("id")
      .eq("inquiry_id", inquiryId).eq("amount_cents", cents).eq("status", "active").limit(1),
    supabase.from(STAGING_TABLE).select("id")
      .eq("inquiry_id", inquiryId).eq("amount_cents", cents).eq("status", "pending").limit(1),
  ]);
  if (ledger.error || staged.error) throw ledger.error ?? staged.error;
  return (ledger.data?.length ?? 0) > 0 || (staged.data?.length ?? 0) > 0;
}

export async function stageDetectedPayment(
  supabase: SupabaseServerClient,
  payment: DetectedPayment,
): Promise<LedgerStagingOutcome> {
  const cents = parsePositivePaymentCents(payment.amount);
  if (!cents) return "no_amount";

  try {
    if (await hasMatchingPayment(supabase, payment.inquiryId, cents)) return "already_recorded";

    const { error } = await supabase.from(STAGING_TABLE).insert({
      fingerprint: paymentFingerprint({
        clientEmail: payment.clientEmail,
        clientName: payment.clientName,
        amountCents: cents,
        paidAt: payment.detectedAt,
        method: payment.method ?? "",
      }),
      inquiry_id: payment.inquiryId,
      client_name: payment.clientName,
      client_email: payment.clientEmail,
      amount: payment.amount ?? "",
      amount_cents: cents,
      method: payment.method ?? "",
      payment_type: "deposit_1",
      invoice: "",
      note: `Check payment: ${payment.note} (paid date = date detected; adjust if needed)`,
      source: CHECK_PAYMENT_SOURCE,
      source_txn_id: "",
      paid_at: payment.detectedAt,
      session_date: payment.sessionDate,
      evidence: payment.evidence.slice(0, EVIDENCE_MAX_CHARS),
      status: "pending",
    });
    if (error) throw error;
    return "staged";
  } catch (err) {
    console.error("[check-payment] staging detected payment failed:", err);
    return "failed";
  }
}
