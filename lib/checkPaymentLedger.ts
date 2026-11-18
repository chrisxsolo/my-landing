// When /api/check-payment marks an inquiry paid, the money must also enter the
// revenue pipeline — otherwise the client reads "Paid" while revenue reads $0.
// The detection is staged and then confirmed straight away
// (lib/paymentAutoConfirm), the same path Sync All uses; it only stays in the
// review queue when it looks like a payment that is already recorded.

import type { createSupabaseServerClient } from "@/lib/supabaseServer";
import { parsePositivePaymentCents } from "@/lib/paymentAmount";
import { paymentFingerprint } from "@/lib/paymentFingerprint";
import { STAGING_TABLE } from "@/lib/paymentApproval";
import { autoConfirmStaged } from "@/lib/paymentAutoConfirm";
import { PAYMENT_SOURCE, formatReviewDollars } from "@/lib/paymentSyncShared";

const PAYMENTS_TABLE = "payments";
// Must be a value allowed by payments_source_check, since approval copies it.
const CHECK_PAYMENT_SOURCE = PAYMENT_SOURCE.clientCheck;
const EVIDENCE_MAX_CHARS = 500;

/** "recorded" = in the ledger and applied; "staged" = held for review as a possible duplicate. */
export type LedgerStagingOutcome = "recorded" | "staged" | "already_recorded" | "no_amount" | "failed";

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

/** Where a payment of this amount for this booking already lives, if anywhere. */
async function findMatchingPayment(supabase: SupabaseServerClient, inquiryId: number, cents: number): Promise<"ledger" | "review" | null> {
  const [ledger, staged] = await Promise.all([
    supabase.from(PAYMENTS_TABLE).select("id")
      .eq("inquiry_id", inquiryId).eq("amount_cents", cents).eq("status", "active").limit(1),
    supabase.from(STAGING_TABLE).select("id")
      .eq("inquiry_id", inquiryId).eq("amount_cents", cents).eq("status", "pending").limit(1),
  ]);
  if (ledger.error || staged.error) throw ledger.error ?? staged.error;
  if (ledger.data?.length) return "ledger";
  return staged.data?.length ? "review" : null;
}

export async function stageDetectedPayment(
  supabase: SupabaseServerClient,
  payment: DetectedPayment,
): Promise<LedgerStagingOutcome> {
  const cents = parsePositivePaymentCents(payment.amount);
  if (!cents) return "no_amount";

  try {
    const existing = await findMatchingPayment(supabase, payment.inquiryId, cents);
    if (existing === "ledger") return "already_recorded";
    // A detection of this amount is waiting in review (it could not be tied
    // to this client safely); say so instead of calling it recorded.
    if (existing === "review") return "staged";

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
    const confirmation = await autoConfirmStaged(supabase, { inquiryId: payment.inquiryId });
    return confirmation.confirmed.length > 0 ? "recorded" : "staged";
  } catch (err) {
    console.error("[check-payment] staging detected payment failed:", err);
    return "failed";
  }
}

export type DetectedPaymentResponse = {
  paid: true;
  amount: string;
  method: null;
  note: string;
  session_date_booked: boolean;
  evidence: string[];
  ledger: "recorded";
  warning?: string;
};

/**
 * Check payment's fast path: a payment Sync All already detected for this
 * booking is recorded now, with no Gmail or AI round trip. Null means there
 * was none (or it could not be confirmed safely) and the full scan should run.
 */
export async function confirmDetectedPayment(
  supabase: SupabaseServerClient, inquiryId: number,
): Promise<DetectedPaymentResponse | null> {
  if (!Number.isSafeInteger(inquiryId) || inquiryId <= 0) return null;
  try {
    const outcome = await autoConfirmStaged(supabase, { inquiryId });
    if (!outcome.confirmed.length) return null;
    const amounts = outcome.confirmed.map(c => formatReviewDollars(c.amountCents)).join(" + ");
    const unfinished = outcome.incomplete.length > 0 || outcome.failed.length > 0;
    return {
      paid: true,
      amount: amounts,
      method: null,
      note: `${amounts} already detected for this client`,
      // The booking update marks the session date booked unless a step failed.
      session_date_booked: !unfinished,
      evidence: [],
      ledger: "recorded",
      ...(unfinished ? { warning: "Payment recorded, but part of the booking update failed. Finish it in Payments → review." } : {}),
    };
  } catch (error) {
    console.error("[check-payment] confirming detected payment failed:", error);
    return null;
  }
}
