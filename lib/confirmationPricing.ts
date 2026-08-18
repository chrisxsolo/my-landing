// ─────────────────────────────────────────────────────────────────────────────
// Pricing shown in the booking confirmation email.
//
// The deposit a client paid is often nowhere in the database — a shoot booked
// entirely over email leaves only a deposit_paid_at stamp. These helpers work
// out what the session costs from the published rate card, split it by the
// booking policy's retainer percentage, and fall back to that retainer as the
// payment figure when no real amount was ever recorded.
//
// Pure functions — unit tested in tests/unit/confirmationPricing.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { BOOKING_POLICY, calculatePaymentSchedule } from "@/lib/pricingCatalog";
import { catalogSessionTotalCents, type PaymentTotalInquiry } from "@/lib/paymentTotalInference";

/** Where the amount shown as "Payment Received" came from. */
export type AmountSource = "recorded" | "thread" | "retainer" | "none";

export type ConfirmationPricing = {
  /** Money received, e.g. "$225". Empty when nothing could be determined. */
  amount: string;
  amountSource: AmountSource;
  /** Full session price, e.g. "$450". Empty when the shoot can't be priced. */
  sessionTotal: string;
  /** Still owed, e.g. "$225". Empty when unknown; "paid" when settled. */
  balanceDue: string;
  balanceNote: string;
};

const EMPTY: ConfirmationPricing = {
  amount: "", amountSource: "none", sessionTotal: "", balanceDue: "", balanceNote: "",
};

/** Parse any money-ish text ("150", "$1,500.50", "150 dollars") into cents. */
export function parseMoneyCents(raw: string | number | null | undefined): number {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
  const match = text.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) return 0;
  const value = Math.round(parseFloat(match[0]) * 100);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Render cents as "$450" / "$450.50". */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

export function resolveConfirmationPricing(input: {
  inquiry: PaymentTotalInquiry | null | undefined;
  /** Amount from payment_note, the ledger, or a staged payment. */
  recordedAmount?: string | null;
  /** Amount the AI read as paid in the email thread. */
  threadAmount?: string | null;
  /** Session price the photographer quoted in the email thread. */
  threadTotal?: string | null;
}): ConfirmationPricing {
  const { inquiry, recordedAmount, threadAmount, threadTotal } = input;

  const paidCents = parseMoneyCents(recordedAmount) || parseMoneyCents(threadAmount);
  const amountSource: AmountSource = parseMoneyCents(recordedAmount) ? "recorded"
    : parseMoneyCents(threadAmount) ? "thread"
    : "none";

  // A price quoted in the thread beats the rate card — it accounts for add-ons
  // and any discount the catalog can't know about.
  const totalCents = parseMoneyCents(threadTotal) || catalogSessionTotalCents(inquiry);

  if (!totalCents) {
    return paidCents
      ? { ...EMPTY, amount: formatCents(paidCents), amountSource }
      : EMPTY;
  }

  const { retainer } = calculatePaymentSchedule(totalCents);

  // Nothing recorded and nothing in the thread: the policy retainer is the
  // best estimate of what they sent to reserve the date.
  const finalPaidCents = paidCents || retainer;
  const finalSource: AmountSource = paidCents ? amountSource : "retainer";

  // A payment above the session price means the total is wrong, not that the
  // client overpaid — drop the breakdown rather than show a negative balance.
  if (finalPaidCents > totalCents) {
    return { ...EMPTY, amount: formatCents(finalPaidCents), amountSource: finalSource };
  }

  const balanceCents = totalCents - finalPaidCents;
  return {
    amount: formatCents(finalPaidCents),
    amountSource: finalSource,
    sessionTotal: formatCents(totalCents),
    balanceDue: balanceCents > 0 ? formatCents(balanceCents) : "",
    balanceNote: balanceCents > 0 ? `due ${BOOKING_POLICY.remainingBalanceDeadline}` : "Paid in full ✓",
  };
}
