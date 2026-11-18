/** `source` values written to payments_staging by each detector. */
export const PAYMENT_SOURCE = {
  /** A payment provider's notification email naming a payer. */
  notification: "pass1",
  /** Found by reading one client's own mail during Sync All. */
  clientSweep: "pass2",
  /** Found by Check payment for one client. */
  clientCheck: "auto",
} as const;

/** Inquiry statuses that mean the client did not book. */
export const CLOSED_INQUIRY_STATUSES: ReadonlySet<string> =
  new Set(["not_interested", "archived", "declined", "cancelled", "ghosted"]);

export type PaymentSyncMonth = {
  year: number;
  month: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parsePaymentSyncMonth(input: unknown): PaymentSyncMonth | null {
  if (!input || typeof input !== "object") return null;
  const value = input as { year?: unknown; month?: unknown };
  if (typeof value.year !== "number" || typeof value.month !== "number") return null;
  if (!Number.isInteger(value.year) || !Number.isInteger(value.month)) return null;
  if (value.year < 2000 || value.year > 2100) return null;
  if (value.month < 1 || value.month > 12) return null;
  return { year: value.year, month: value.month };
}

export function buildGmailMonthFilter(year: number, month: number): string {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const startPart = `${start.getFullYear()}/${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}`;
  const endPart = `${end.getFullYear()}/${pad2(end.getMonth() + 1)}/${pad2(end.getDate())}`;
  return `after:${startPart} before:${endPart}`;
}

export function withGmailMonthFilter(query: string, month: PaymentSyncMonth | null): string {
  if (!month) return query;
  return `${query} ${buildGmailMonthFilter(month.year, month.month)}`;
}

/** Staged payments that are detected but not yet counted as revenue. */
export type PendingReviewSummary = {
  count: number;
  cents: number;
};

export function summarizePendingReview(rows: { amount_cents: number | null }[]): PendingReviewSummary {
  return rows.reduce<PendingReviewSummary>(
    (acc, row) => ({ count: acc.count + 1, cents: acc.cents + (row.amount_cents ?? 0) }),
    { count: 0, cents: 0 },
  );
}

export function formatReviewDollars(cents: number): string {
  const hasCents = cents % 100 !== 0;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * One-line sync result for the admin UI. Payments tied to one booking are
 * confirmed by the sync itself; only the ones it could not place wait for a
 * person, and those are not revenue until someone approves them.
 */
export function describePaymentSyncOutcome(input: {
  total: number;
  confirmed?: number;
  pendingReview?: PendingReviewSummary | null;
  warnings?: string[];
}): string {
  const parts = [`${input.total} new payment${input.total === 1 ? "" : "s"} found.`];
  const confirmed = input.confirmed ?? 0;
  if (confirmed > 0) {
    parts.push(`${confirmed} payment${confirmed === 1 ? "" : "s"} recorded and the booking${confirmed === 1 ? "" : "s"} updated.`);
  }
  const pending = input.pendingReview;
  if (pending && pending.count > 0) {
    parts.push(
      `${pending.count} payment${pending.count === 1 ? "" : "s"} (${formatReviewDollars(pending.cents)}) ` +
      "need your review (no clear client match, or possibly already recorded) — not counted in revenue until approved.",
    );
  } else {
    parts.push("Nothing awaiting approval.");
  }
  if (input.warnings?.length) parts.push(`⚠ ${input.warnings.join(" ")}`);
  return parts.join(" ");
}

const OFFLINE_NOTICE = /payment (?:is )?on the way/i;

/**
 * True when a staged row's evidence is an invoicing provider's "payment on the
 * way" notice: the client CHOSE an offline method (Zelle, Venmo, cash). That
 * is a promise to pay, not a receipt — the reviewer has to confirm the money
 * arrived. Matched notices are recorded automatically; this flags the ones
 * left in the review queue.
 */
export function isOfflinePaymentNotice(evidence: string | null | undefined): boolean {
  return !!evidence && OFFLINE_NOTICE.test(evidence);
}
