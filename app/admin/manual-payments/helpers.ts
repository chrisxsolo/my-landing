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
  name = "",
): SavedPayment[] {
  const emailNeedle = email.trim().toLowerCase();
  // Name matching is the last resort for ledger rows recorded without an
  // email (e.g. Zelle imports) — only used when neither side has one.
  const nameNeedle = name.trim().toLowerCase();
  return payments.filter(p => p.status === "active" && (
    (inquiryId != null && p.inquiry_id === inquiryId)
    || (!!emailNeedle && p.client_email?.toLowerCase() === emailNeedle)
    || (!emailNeedle && !p.client_email && !!nameNeedle && p.client_name.trim().toLowerCase() === nameNeedle)
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
  const related = inquiry ? relatedPayments(payments, inquiry.id, inquiry.email, inquiry.name) : [];
  return seedFromRelated(related, inquiry);
}

/** Same seeding rules, fed directly with a client's saved payments. */
export function seedFromRelated(
  related: SavedPayment[],
  inquiry: InquiryOption | null,
): SeededAmounts {
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

/**
 * Rows for clients who exist only in the payments ledger (no inquiry) — e.g.
 * a Zelle payer recorded without an email. Without these, a paid client can
 * "disappear" from the spreadsheet entirely. Seeded exactly like inquiry
 * rows so the remaining balance is one edit + save away.
 */
export function paymentOnlyRows(payments: SavedPayment[], inquiries: InquiryOption[]): PaymentRow[] {
  const inquiryEmails = new Set(inquiries.map(i => i.email.trim().toLowerCase()).filter(Boolean));
  const groups = new Map<string, SavedPayment[]>();
  for (const p of payments) {
    if (p.status !== "active" || p.inquiry_id != null) continue;
    const email = p.client_email?.trim().toLowerCase() ?? "";
    if (email && inquiryEmails.has(email)) continue; // already shown via the inquiry row
    const key = email || p.client_name.trim().toLowerCase();
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }

  return [...groups.entries()].map(([key, related]) => {
    const seed = seedFromRelated(related, null);
    const newest = [...related].sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))[0];
    return {
      key: `payment-${key}`,
      inquiry_id: null,
      client_name: newest.client_name,
      client_email: newest.client_email ?? "",
      amount: "",
      method: newest.method || "Venmo",
      payment_type: seed.nextType,
      paid_at: today(),
      session_date: newest.session_date?.slice(0, 10) ?? "",
      invoice: newest.invoice ?? "",
      note: "",
      ...seed,
      touched: false,
    };
  }).sort((a, b) => a.client_name.localeCompare(b.client_name));
}

export type AmountCol = "d1" | "d2" | "full";

/**
 * Keep the three amounts coherent while typing. `flags` must be the LIVE
 * paid state (derived from current payments) — after "Clear payments" voids
 * a client's rows, the seeded flags on the row object are stale and editing
 * the full total must re-split both deposits again.
 *
 *  - edit full → re-split the unpaid deposits per the schedule
 *  - edit one deposit → rebalance the other against the fixed total
 *    (or extend the total when the other deposit is already recorded)
 */
export function rebalanceAmounts(
  row: Pick<PaymentRow, "d1" | "d2" | "full">,
  col: AmountCol,
  value: string,
  flags: { d1Paid: boolean; d2Paid: boolean },
): Pick<PaymentRow, "d1" | "d2" | "full"> {
  const next = { d1: row.d1, d2: row.d2, full: row.full, [col]: value };
  const cents = parseLoosePaymentCents(value);
  const d1 = parseLoosePaymentCents(next.d1);
  const d2 = parseLoosePaymentCents(next.d2);
  const fullCents = parseLoosePaymentCents(next.full);

  if (col === "full" && cents > 0) {
    if (!flags.d1Paid && !flags.d2Paid) {
      const schedule = calculatePaymentSchedule(cents);
      next.d1 = formatCents(schedule.retainer);
      next.d2 = formatCents(schedule.remainingBalance);
    } else if (flags.d1Paid && !flags.d2Paid) {
      next.d2 = formatCents(Math.max(cents - d1, 0));
    } else if (!flags.d1Paid && flags.d2Paid) {
      next.d1 = formatCents(Math.max(cents - d2, 0));
    }
  } else if (col === "d1" && cents >= 0) {
    if (flags.d2Paid) next.full = formatCents(cents + d2);
    else if (fullCents > 0) next.d2 = formatCents(Math.max(fullCents - cents, 0));
    else if (d2 > 0) next.full = formatCents(cents + d2);
  } else if (col === "d2" && cents >= 0) {
    if (flags.d1Paid) next.full = formatCents(cents + d1);
    else if (fullCents > 0) next.d1 = formatCents(Math.max(fullCents - cents, 0));
    else if (d1 > 0) next.full = formatCents(cents + d1);
  }
  return next;
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
