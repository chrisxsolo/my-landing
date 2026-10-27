// Headline revenue figures for the admin Home tab, computed from the payments
// ledger with the same rules as the Revenue dashboard (lib/revenue/calc).
//
// The Home card used to parse the latest `payment_note` on each inquiry and
// bucket it by `payment_detected_at` (the moment a sync or approval ran). That
// counted only one payment per client, skipped payments not linked to an
// inquiry, and dated revenue by when it was detected rather than when it was
// paid, so the card could read $0 in a month with real payments.

import {
  buildMonthPeriod,
  buildRelativePeriod,
  isConfirmedRevenuePayment,
  paymentMatchesPeriod,
  type PaymentPeriod,
  type PaymentPeriodRow,
} from "@/lib/paymentAnalytics";

export type HeadlineRevenue = {
  thisMonthCents: number;
  lastMonthCents: number;
  ytdCents: number;
};

function centsOf(row: PaymentPeriodRow): number {
  return row.amount_cents ?? 0;
}

export function collectedCentsIn(rows: PaymentPeriodRow[], period: PaymentPeriod): number {
  return rows
    .filter(row => isConfirmedRevenuePayment(row) && paymentMatchesPeriod(row, period))
    .reduce((sum, row) => sum + centsOf(row), 0);
}

export function headlineRevenue(rows: PaymentPeriodRow[], now = new Date()): HeadlineRevenue {
  return {
    thisMonthCents: collectedCentsIn(rows, buildRelativePeriod("thisMonth", now)),
    lastMonthCents: collectedCentsIn(rows, buildMonthPeriod(now.getFullYear(), now.getMonth() - 1)),
    ytdCents: collectedCentsIn(rows, buildRelativePeriod("thisYear", now)),
  };
}

type BookingRow = PaymentPeriodRow & { inquiry_id?: number | null; client_email?: string | null; client_name?: string | null };

/** Mean collected revenue per booking (linked inquiry, else payer email or name). */
export function averageBookingCents(rows: BookingRow[]): number | null {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!isConfirmedRevenuePayment(row)) continue;
    const key = row.inquiry_id != null ? `inq-${row.inquiry_id}` : `payer-${(row.client_email || row.client_name || "").toLowerCase().trim()}`;
    totals.set(key, (totals.get(key) ?? 0) + centsOf(row));
  }
  if (!totals.size) return null;
  return Math.round([...totals.values()].reduce((a, b) => a + b, 0) / totals.size);
}
