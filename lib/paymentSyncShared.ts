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
 * One-line sync result for the admin UI. "Synced" alone is misleading because
 * the sync only stages rows: revenue changes when they are approved.
 */
export function describePaymentSyncOutcome(input: {
  total: number;
  pendingReview?: PendingReviewSummary | null;
  warnings?: string[];
}): string {
  const parts = [`${input.total} new payment${input.total === 1 ? "" : "s"} found.`];
  const pending = input.pendingReview;
  if (pending && pending.count > 0) {
    parts.push(
      `${pending.count} payment${pending.count === 1 ? "" : "s"} (${formatReviewDollars(pending.cents)}) ` +
      "awaiting your approval — not counted in revenue until approved.",
    );
  } else {
    parts.push("Nothing awaiting approval.");
  }
  if (input.warnings?.length) parts.push(`⚠ ${input.warnings.join(" ")}`);
  return parts.join(" ");
}
