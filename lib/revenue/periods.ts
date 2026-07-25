// Date-range presets and comparison-period derivation for the Revenue dashboard.
// A payment's date of record is paid_at ?? session_date (same convention as
// lib/paymentAnalytics.ts). All ranges are inclusive.

import type { PaymentPeriod } from "@/lib/paymentAnalytics";

export type DatePreset =
  | "thisMonth"
  | "lastMonth"
  | "last30"
  | "last90"
  | "ytd"
  | "lastYear"
  | "gradSeason"
  | "all"
  | "custom";

export type CompareMode = "prevPeriod" | "prevMonth" | "prevYear" | "none";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "lastYear", label: "Last year" },
  { value: "gradSeason", label: "Grad season" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

export const COMPARE_MODES: { value: CompareMode; label: string }[] = [
  { value: "prevPeriod", label: "vs previous period" },
  { value: "prevMonth", label: "vs previous month" },
  { value: "prevYear", label: "vs previous year" },
  { value: "none", label: "No comparison" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function monthPeriod(year: number, month: number): PaymentPeriod {
  const start = new Date(year, month, 1);
  return {
    start,
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

function rangeLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameYear = start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString("en-US", sameYear ? opts : { ...opts, year: "numeric" });
  const e = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${s} – ${e}`;
}

/** Graduation season = March 1 through June 30. */
export function gradSeasonPeriod(year: number): PaymentPeriod {
  return {
    start: new Date(year, 2, 1),
    end: new Date(year, 5, 30, 23, 59, 59, 999),
    label: `Grad season ${year}`,
  };
}

export function buildPresetPeriod(
  preset: DatePreset,
  now = new Date(),
  custom?: { start: string; end: string },
): PaymentPeriod {
  switch (preset) {
    case "thisMonth":
      return monthPeriod(now.getFullYear(), now.getMonth());
    case "lastMonth":
      return monthPeriod(now.getFullYear(), now.getMonth() - 1);
    case "last30": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getTime() - 29 * DAY_MS));
      return { start, end, label: "Last 30 days" };
    }
    case "last90": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getTime() - 89 * DAY_MS));
      return { start, end, label: "Last 90 days" };
    }
    case "ytd":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endOfDay(now),
        label: `${now.getFullYear()} YTD`,
      };
    case "lastYear":
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
        label: `${now.getFullYear() - 1}`,
      };
    case "gradSeason": {
      // If grad season hasn't started yet this year, show last year's.
      const seasonYear = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
      return gradSeasonPeriod(seasonYear);
    }
    case "custom": {
      const start = custom?.start ? startOfDay(new Date(`${custom.start}T12:00:00`)) : null;
      const end = custom?.end ? endOfDay(new Date(`${custom.end}T12:00:00`)) : null;
      if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return { start: null, end: null, label: "Custom range" };
      }
      return { start, end, label: rangeLabel(start, end) };
    }
    case "all":
    default:
      return { start: null, end: null, label: "All time" };
  }
}

/**
 * Derive the comparison period for a selected period. Returns null when no
 * meaningful comparison exists (open-ended ranges, compare mode off).
 */
export function buildComparisonPeriod(
  period: PaymentPeriod,
  mode: CompareMode,
): PaymentPeriod | null {
  if (mode === "none" || !period.start || !period.end) return null;
  const { start, end } = period;

  if (mode === "prevPeriod") {
    const spanMs = end.getTime() - start.getTime();
    // Calendar-month ranges shift by whole months so Feb/Mar lengths stay honest.
    if (isWholeMonths(start, end)) {
      const months = monthSpan(start, end);
      const prevStart = new Date(start.getFullYear(), start.getMonth() - months, 1);
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
      return { start: prevStart, end: prevEnd, label: rangeLabel(prevStart, prevEnd) };
    }
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    return { start: prevStart, end: prevEnd, label: rangeLabel(prevStart, prevEnd) };
  }

  if (mode === "prevMonth") {
    const prevStart = shiftedDate(start.getFullYear(), start.getMonth() - 1, start.getDate());
    const prevEnd = endOfDay(shiftedDate(end.getFullYear(), end.getMonth() - 1, end.getDate()));
    return { start: prevStart, end: prevEnd, label: rangeLabel(prevStart, prevEnd) };
  }

  // prevYear
  const prevStart = shiftedDate(start.getFullYear() - 1, start.getMonth(), start.getDate());
  const prevEnd = endOfDay(shiftedDate(end.getFullYear() - 1, end.getMonth(), end.getDate()));
  return { start: prevStart, end: prevEnd, label: rangeLabel(prevStart, prevEnd) };
}

// Clamp the day so month-end dates land in the target month instead of
// overflowing into the next one (Jul 31 shifted to June must be Jun 30, not Jul 1).
function shiftedDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function isWholeMonths(start: Date, end: Date): boolean {
  const isFirstDay = start.getDate() === 1;
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return isFirstDay && end.getDate() === lastDay;
}

function monthSpan(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

/** Fraction of the period that has elapsed as of `now`, clamped to [0,1]. */
export function elapsedFraction(period: PaymentPeriod, now = new Date()): number {
  if (!period.start || !period.end) return 1;
  const total = period.end.getTime() - period.start.getTime();
  if (total <= 0) return 1;
  const elapsed = now.getTime() - period.start.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}
