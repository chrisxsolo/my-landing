// Financial calculation definitions for the Revenue dashboard. Formulas:
//
//   collected         Σ amount_cents of confirmed active revenue rows
//                     (isConfirmedRevenuePayment: status=active, amount>0,
//                      not an unverified auto-recorded note)
//   refunds           Σ amount_cents of refunded rows + refund_cents on active rows
//   fees              Σ fee_cents on confirmed active rows
//   net               collected − fees − refunds  (refund-adjusted net revenue)
//   avgPayment        collected / paymentCount
//   revenuePerClient  collected / uniqueClients (client = email, else name)
//   deposits          collected where payment_type ∈ {deposit_1}
//   balances          collected where payment_type ∈ {deposit_2}
//   fullPayments      collected where payment_type = full
//   avgBookingValue   collected / distinct bookings (booking = inquiry, else client)
//   concentration     Σ top-N group share of collected
//   collectionRate    collected / (collected + outstanding estimate)
//   delta             zero-safe period-over-period change (see safeDelta)

import { isConfirmedRevenuePayment } from "@/lib/paymentAnalytics";
import type { LedgerRow } from "./enrich";

export const clientKeyOf = (p: { client_email: string; client_name: string }): string =>
  (p.client_email || p.client_name).toLowerCase().trim();

export const bookingKeyOf = (p: LedgerRow): string =>
  p.inquiry_id != null ? `inq-${p.inquiry_id}` : `client-${clientKeyOf(p)}`;

export const rowCents = (p: LedgerRow): number => p.amount_cents || 0;

export function confirmedRows(rows: LedgerRow[]): LedgerRow[] {
  return rows.filter(isConfirmedRevenuePayment) as LedgerRow[];
}

export type PeriodSummary = {
  collectedCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  paymentCount: number;
  uniqueClients: number;
  uniqueBookings: number;
  avgPaymentCents: number;
  avgBookingCents: number;
  perClientCents: number;
  depositCents: number;
  balanceCents: number;
  fullCents: number;
  refundedCount: number;
};

export function summarizePeriod(periodRows: LedgerRow[]): PeriodSummary {
  const revenue = confirmedRows(periodRows);
  const refunded = periodRows.filter(p => p.status === "refunded");

  const collectedCents = revenue.reduce((s, p) => s + rowCents(p), 0);
  const feeCents = revenue.reduce((s, p) => s + (p.fee_cents || 0), 0);
  const refundCents =
    refunded.reduce((s, p) => s + rowCents(p), 0) +
    revenue.reduce((s, p) => s + (p.refund_cents || 0), 0);

  const clients = new Set(revenue.map(clientKeyOf));
  const bookings = new Set(revenue.map(bookingKeyOf));
  const sumWhere = (pred: (p: LedgerRow) => boolean) =>
    revenue.filter(pred).reduce((s, p) => s + rowCents(p), 0);

  const paymentCount = revenue.length;
  return {
    collectedCents,
    feeCents,
    refundCents,
    netCents: collectedCents - feeCents - refundCents,
    paymentCount,
    uniqueClients: clients.size,
    uniqueBookings: bookings.size,
    avgPaymentCents: paymentCount ? Math.round(collectedCents / paymentCount) : 0,
    avgBookingCents: bookings.size ? Math.round(collectedCents / bookings.size) : 0,
    perClientCents: clients.size ? Math.round(collectedCents / clients.size) : 0,
    depositCents: sumWhere(p => p.payment_type === "deposit_1"),
    balanceCents: sumWhere(p => p.payment_type === "deposit_2"),
    fullCents: sumWhere(p => p.payment_type === "full"),
    refundedCount: refunded.length,
  };
}

// ── Zero-safe period-over-period change ─────────────────────────────────────
// "pct"  → valid percentage change vs a non-zero baseline
// "new"  → baseline was zero, current is not ("New revenue", not "+∞%")
// "zero" → both zero
// "none" → no comparison period selected / available
export type Delta =
  | { kind: "pct"; ratio: number; diff: number }
  | { kind: "new"; diff: number }
  | { kind: "zero" }
  | { kind: "none" };

export function safeDelta(current: number, previous: number | null): Delta {
  if (previous === null) return { kind: "none" };
  if (previous === 0) return current === 0 ? { kind: "zero" } : { kind: "new", diff: current };
  return { kind: "pct", ratio: (current - previous) / Math.abs(previous), diff: current - previous };
}

// ── Grouped breakdowns ──────────────────────────────────────────────────────
export type BreakdownEntry = {
  key: string;
  cents: number;
  count: number;
  clients: number;
  bookings: number;
  share: number; // of the period's collected revenue
  avgBookingCents: number;
};

export function breakdownBy(
  periodRows: LedgerRow[],
  keyOf: (p: LedgerRow) => string,
): BreakdownEntry[] {
  const revenue = confirmedRows(periodRows);
  const total = revenue.reduce((s, p) => s + rowCents(p), 0);
  const groups = new Map<string, LedgerRow[]>();
  for (const p of revenue) {
    const key = keyOf(p);
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => {
      const cents = rows.reduce((s, p) => s + rowCents(p), 0);
      const bookings = new Set(rows.map(bookingKeyOf)).size;
      return {
        key,
        cents,
        count: rows.length,
        clients: new Set(rows.map(clientKeyOf)).size,
        bookings,
        share: total > 0 ? cents / total : 0,
        avgBookingCents: bookings ? Math.round(cents / bookings) : 0,
      };
    })
    .sort((a, b) => b.cents - a.cents);
}

/** Share of collected revenue produced by the top `n` entries of a breakdown. */
export function topShare(entries: BreakdownEntry[], n: number): number {
  return entries.slice(0, n).reduce((s, e) => s + e.share, 0);
}

/** collected / (collected + outstanding). 1 when nothing is outstanding. */
export function collectionRate(collectedCents: number, outstandingCents: number): number {
  const total = collectedCents + outstandingCents;
  return total > 0 ? collectedCents / total : 1;
}
