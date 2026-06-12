// Time-series bucketing for the trend chart, seasonality heatmap and pace
// module. Date of record: paid_at ?? session_date (lib/paymentAnalytics).

import { paymentMatchesPeriod, type PaymentPeriod } from "@/lib/paymentAnalytics";
import { elapsedFraction } from "./periods";
import { confirmedRows, rowCents } from "./calc";
import type { LedgerRow } from "./enrich";

export type Granularity = "day" | "week" | "month" | "cumulative";

export type SeriesPoint = {
  t: number; // bucket start ms
  label: string;
  cents: number;
  count: number;
};

function rowDate(p: LedgerRow): Date | null {
  const raw = p.paid_at ?? p.session_date;
  if (!raw) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const d = new Date(dateOnly ? `${raw}T12:00:00` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar-field arithmetic throughout: adding milliseconds drifts an hour
// across DST transitions, which desynchronizes iterated bucket keys from
// data bucket keys and silently zeroes every bucket after the change.
function bucketStart(d: Date, g: "day" | "week" | "month"): Date {
  if (g === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (g === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Weeks start on Monday.
  const offset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

function nextBucket(d: Date, g: "day" | "week" | "month"): Date {
  if (g === "month") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (g === "day" ? 1 : 7));
}

function bucketLabel(d: Date, g: "day" | "week" | "month"): string {
  if (g === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Pick a sensible default granularity for the span of a period. */
export function autoGranularity(period: PaymentPeriod): "day" | "week" | "month" {
  if (!period.start || !period.end) return "month";
  const days = (period.end.getTime() - period.start.getTime()) / DAY_MS;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}

/**
 * Bucket confirmed revenue into a continuous series across the period
 * (zero-filled buckets included so the line doesn't lie by omission).
 * Open-ended periods derive their bounds from the data itself.
 */
export function bucketSeries(
  periodRows: LedgerRow[],
  period: PaymentPeriod,
  granularity: "day" | "week" | "month",
  onlyConfirmed = true, // pass false when the rows are pre-filtered (e.g. refunds)
): SeriesPoint[] {
  const revenue = onlyConfirmed ? confirmedRows(periodRows) : periodRows;
  const dated = revenue
    .map(p => ({ p, d: rowDate(p) }))
    .filter((x): x is { p: LedgerRow; d: Date } => x.d !== null);
  if (!dated.length) return [];

  const min = period.start ?? new Date(Math.min(...dated.map(x => x.d.getTime())));
  const max = period.end ?? new Date(Math.max(...dated.map(x => x.d.getTime())));

  const byBucket = new Map<number, { cents: number; count: number }>();
  for (const { p, d } of dated) {
    const t = bucketStart(d, granularity).getTime();
    const entry = byBucket.get(t) ?? { cents: 0, count: 0 };
    byBucket.set(t, { cents: entry.cents + rowCents(p), count: entry.count + 1 });
  }

  const points: SeriesPoint[] = [];
  for (let cur = bucketStart(min, granularity); cur <= max; cur = nextBucket(cur, granularity)) {
    const entry = byBucket.get(cur.getTime());
    points.push({
      t: cur.getTime(),
      label: bucketLabel(cur, granularity),
      cents: entry?.cents ?? 0,
      count: entry?.count ?? 0,
    });
    if (points.length > 400) break; // hard cap for pathological custom ranges
  }
  return points;
}

export function toCumulative(points: SeriesPoint[]): SeriesPoint[] {
  let cents = 0;
  let count = 0;
  return points.map(p => {
    cents += p.cents;
    count += p.count;
    return { ...p, cents, count };
  });
}

// ── Seasonality heatmap: revenue by month × year ────────────────────────────
export type HeatmapCell = { year: number; month: number; cents: number; count: number };

export function monthlyHeatmap(allRows: LedgerRow[]): HeatmapCell[] {
  const revenue = confirmedRows(allRows);
  const map = new Map<string, HeatmapCell>();
  for (const p of revenue) {
    const d = rowDate(p);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const cell = map.get(key) ?? { year: d.getFullYear(), month: d.getMonth(), cents: 0, count: 0 };
    cell.cents += rowCents(p);
    cell.count += 1;
    map.set(key, cell);
  }
  return [...map.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

// ── Revenue pace ────────────────────────────────────────────────────────────
// soFar           collected so far in the (still running) period
// compAtSamePoint comparison-period revenue at the equivalent elapsed fraction
// compTotal       comparison period's full total
// projected       linear pace estimate: soFar / elapsedFraction — an estimate,
//                 never presented as booked or guaranteed income
export type Pace = {
  soFarCents: number;
  compAtSamePointCents: number | null;
  compTotalCents: number | null;
  projectedCents: number | null;
  elapsed: number;
};

export function revenuePace(
  periodRows: LedgerRow[],
  period: PaymentPeriod,
  compRows: LedgerRow[] | null,
  compPeriod: PaymentPeriod | null,
  now = new Date(),
): Pace {
  const elapsed = elapsedFraction(period, now);
  const soFarCents = confirmedRows(periodRows).reduce((s, p) => s + rowCents(p), 0);

  let compAtSamePointCents: number | null = null;
  let compTotalCents: number | null = null;
  if (compRows && compPeriod?.start && compPeriod.end) {
    const compRevenue = confirmedRows(compRows.filter(p => paymentMatchesPeriod(p, compPeriod)));
    compTotalCents = compRevenue.reduce((s, p) => s + rowCents(p), 0);
    const cutoff = compPeriod.start.getTime()
      + elapsed * (compPeriod.end.getTime() - compPeriod.start.getTime());
    compAtSamePointCents = compRevenue.reduce((s, p) => {
      const d = rowDate(p);
      return d && d.getTime() <= cutoff ? s + rowCents(p) : s;
    }, 0);
  }

  // Only project when the period is genuinely mid-flight: too early and the
  // estimate is noise, nearly complete and it adds nothing (e.g. YTD ranges
  // that end today are already ~100% elapsed).
  const projectedCents = elapsed > 0.1 && elapsed < 0.95 ? Math.round(soFarCents / elapsed) : null;
  return { soFarCents, compAtSamePointCents, compTotalCents, projectedCents, elapsed };
}
