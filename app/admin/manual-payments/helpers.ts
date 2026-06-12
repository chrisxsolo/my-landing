import { calculatePaymentSchedule, inferTotalFromRetainer } from "@/lib/pricingCatalog";
import {
  inferSessionTotalCents,
  parseKnownMoneyCents,
  parseLoosePaymentCents,
} from "@/lib/paymentTotalInference";
import type { InquiryOption, PaymentRow, SavedPayment } from "./types";

export const METHODS = ["Venmo", "Zelle", "PayPal", "Cash App", "Pixieset", "Cash", "manual", "other"];
export const PAYMENT_TYPES = [
  { value: "deposit_1", label: "Deposit 1" },
  { value: "deposit_2", label: "Deposit 2" },
  { value: "full", label: "Full" },
  { value: "other", label: "Other" },
];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function parseToIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const cleaned = value.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export function displayMoney(amount: string, cents?: number) {
  if (cents && cents > 0) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }
  return amount ? `$${amount.replace(/^\$/, "")}` : "$0";
}

const rowCents = (p: SavedPayment) => p.amount_cents || parseLoosePaymentCents(p.amount);

export function relatedPayments(
  payments: SavedPayment[],
  inquiryId: number | null,
  email: string,
): SavedPayment[] {
  const needle = email.trim().toLowerCase();
  return payments.filter(p => p.status === "active" && (
    (inquiryId != null && p.inquiry_id === inquiryId)
    || (!!needle && p.client_email?.toLowerCase() === needle)
  ));
}

export type SeededAmounts = {
  d1: string;
  d2: string;
  full: string;
  d1Paid: boolean;
  d2Paid: boolean;
  totalSource: string;
  /** The next unpaid step — used as the row's default payment type. */
  nextType: "deposit_1" | "deposit_2" | "full";
};

/**
 * Mirror of the database for one client: saved deposit amounts are shown
 * exactly as recorded; anything unpaid is pre-filled from the inferred
 * session total (full payment → deposit pair → retainer policy → payment
 * note → pricing catalog) and split per the payment schedule.
 */
export function seedAmounts(
  inquiry: InquiryOption | null,
  payments: SavedPayment[],
): SeededAmounts {
  const related = inquiry ? relatedPayments(payments, inquiry.id, inquiry.email) : [];
  const fullPayment = related.find(p => p.payment_type === "full");
  const d1Saved = related.find(p => p.payment_type === "deposit_1");
  const d2Saved = related.find(p => p.payment_type === "deposit_2");

  const d1Cents = d1Saved ? rowCents(d1Saved) : 0;
  const d2Cents = d2Saved ? rowCents(d2Saved) : 0;

  // Full total, most-trustworthy source first.
  let totalCents = 0;
  let totalSource = "manual";
  if (fullPayment) {
    totalCents = rowCents(fullPayment);
    totalSource = "full payment on record";
  } else if (d1Saved && d2Saved) {
    totalCents = d1Cents + d2Cents;
    totalSource = "both deposits on record";
  } else if (d1Saved || d2Saved) {
    totalCents = inferTotalFromRetainer(d1Cents || d2Cents);
    totalSource = "retainer policy estimate";
  } else {
    const noteCents = parseKnownMoneyCents(inquiry?.payment_note);
    if (noteCents > 0) {
      totalCents = noteCents;
      totalSource = "payment note";
    } else if (inquiry) {
      totalCents = inferSessionTotalCents(inquiry);
      totalSource = totalCents > 0 ? "session pricing" : "manual";
    }
  }

  const schedule = calculatePaymentSchedule(totalCents);
  const d1Paid = Boolean(fullPayment || d1Saved);
  const d2Paid = Boolean(fullPayment || d2Saved);

  // Saved figures verbatim; otherwise schedule split (D2 = total − D1 so a
  // custom retainer keeps the pair summing to the total).
  const d1Final = d1Saved ? d1Cents : fullPayment ? Math.round(totalCents / 2) : schedule.retainer;
  const d2Final = d2Saved ? d2Cents : fullPayment ? totalCents - Math.round(totalCents / 2)
    : totalCents > 0 ? totalCents - d1Final : 0;

  return {
    d1: d1Final > 0 ? formatCents(d1Final) : "",
    d2: d2Final > 0 ? formatCents(d2Final) : "",
    full: totalCents > 0 ? formatCents(totalCents) : "",
    d1Paid,
    d2Paid,
    totalSource,
    nextType: !d1Paid ? "deposit_1" : !d2Paid ? "deposit_2" : "full",
  };
}

const EMPTY_SEED: SeededAmounts = {
  d1: "", d2: "", full: "", d1Paid: false, d2Paid: false, totalSource: "manual", nextType: "deposit_1",
};

export function emptyRows(count: number): PaymentRow[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${Date.now()}-${index}`,
    inquiry_id: null,
    client_name: "",
    client_email: "",
    amount: "",
    method: "Venmo",
    payment_type: "deposit_1",
    paid_at: today(),
    session_date: "",
    invoice: "",
    note: "",
    ...EMPTY_SEED,
    touched: false,
  }));
}

export function rowsFromInquiries(list: InquiryOption[], payments: SavedPayment[]): PaymentRow[] {
  return list.map((inquiry, index) => {
    const seed = seedAmounts(inquiry, payments);
    return {
      key: `inquiry-${inquiry.id}-${index}`,
      inquiry_id: inquiry.id,
      client_name: inquiry.name,
      client_email: inquiry.email,
      amount: "",
      method: "Venmo",
      payment_type: seed.nextType,
      paid_at: inquiry.deposit_paid_at?.slice(0, 10) ?? inquiry.payment_detected_at?.slice(0, 10) ?? today(),
      session_date: parseToIsoDate(inquiry.session_date ?? inquiry.date_in_mind),
      invoice: "",
      note: "",
      ...seed,
      touched: false,
    };
  });
}

/** The amount the row would save, given its selected payment type. */
export function amountForType(row: PaymentRow): string {
  if (row.payment_type === "deposit_1") return row.d1;
  if (row.payment_type === "deposit_2") return row.d2;
  if (row.payment_type === "full") return row.full;
  return row.amount;
}

/** True when saving the row's selected type would duplicate a saved payment. */
export function typeAlreadyPaid(row: PaymentRow): boolean {
  if (row.payment_type === "deposit_1") return row.d1Paid;
  if (row.payment_type === "deposit_2") return row.d2Paid;
  if (row.payment_type === "full") return row.d1Paid && row.d2Paid;
  return false;
}

/** Ready = has client + date + a positive, not-yet-recorded amount. */
export function rowIsReady(row: PaymentRow): boolean {
  return Boolean(
    row.client_name.trim()
    && row.paid_at
    && parseLoosePaymentCents(amountForType(row)) > 0
    && !typeAlreadyPaid(row),
  );
}
