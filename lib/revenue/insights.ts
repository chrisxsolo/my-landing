// Deterministic revenue insights. Every insight is computed from the same
// numbers the dashboard renders, and carries its metric, analyzed period,
// comparison baseline, and a drill target that filters the dashboard to the
// supporting records. No generated prose, no advice without data.

import { fmtMoney, fmtPct, fmtShare } from "./format";
import { SERVICE_LABELS, type ServiceKey } from "./enrich";
import { schoolLabel } from "./schools";
import type { BreakdownEntry, Delta, PeriodSummary } from "./calc";
import type { Receivable } from "./receivables";
import type { QualityIssue } from "./quality";

export type DrillTarget =
  | { kind: "service"; value: string }
  | { kind: "school"; value: string }
  | { kind: "method"; value: string }
  | { kind: "receivables" }
  | { kind: "quality" }
  | { kind: "ledger" };

export type Insight = {
  id: string;
  text: string;
  metric: string;
  period: string;
  baseline: string;
  drill: DrillTarget;
};

export type InsightInput = {
  summary: PeriodSummary;
  prevSummary: PeriodSummary | null;
  collectedDelta: Delta;
  services: BreakdownEntry[];
  schools: BreakdownEntry[];
  methods: BreakdownEntry[];
  clients: BreakdownEntry[];
  receivables: Receivable[];
  issues: QualityIssue[];
  periodLabel: string;
  compareLabel: string | null;
};

const CONCENTRATION_WARNING = 0.6;

export function deriveInsights(input: InsightInput): Insight[] {
  const {
    summary, prevSummary, collectedDelta, services, schools, methods, clients,
    receivables, issues, periodLabel, compareLabel,
  } = input;
  const out: Insight[] = [];
  const baseline = compareLabel ?? "no comparison period";

  // Growth / decline
  if (collectedDelta.kind === "pct" && compareLabel && prevSummary) {
    out.push({
      id: "growth",
      text: `Collected revenue ${collectedDelta.ratio >= 0 ? "increased" : "decreased"} ${fmtPct(Math.abs(collectedDelta.ratio))} (${fmtMoney(Math.abs(collectedDelta.diff))}) vs ${compareLabel}.`,
      metric: "Collected revenue",
      period: periodLabel,
      baseline,
      drill: { kind: "ledger" },
    });
    // Avg payment up while volume down — pricing vs volume signal.
    if (summary.avgPaymentCents > prevSummary.avgPaymentCents && summary.paymentCount < prevSummary.paymentCount) {
      out.push({
        id: "price-vs-volume",
        text: `Average payment rose to ${fmtMoney(summary.avgPaymentCents)} (from ${fmtMoney(prevSummary.avgPaymentCents)}) while payment count fell from ${prevSummary.paymentCount} to ${summary.paymentCount} — growth is coming from value, not volume.`,
        metric: "Average payment value",
        period: periodLabel,
        baseline,
        drill: { kind: "ledger" },
      });
    }
  } else if (collectedDelta.kind === "new" && compareLabel) {
    out.push({
      id: "growth-new",
      text: `${fmtMoney(collectedDelta.diff)} collected in ${periodLabel}; ${compareLabel} had no revenue — all of this is new.`,
      metric: "Collected revenue",
      period: periodLabel,
      baseline,
      drill: { kind: "ledger" },
    });
  }

  // Service mix / seasonality dependence
  const topService = services[0];
  if (topService && topService.share >= 0.5) {
    const label = SERVICE_LABELS[topService.key as ServiceKey] ?? topService.key;
    out.push({
      id: "service-concentration",
      text: `${fmtShare(topService.share)} of collected revenue (${fmtMoney(topService.cents)}) came from ${label.toLowerCase()} sessions${topService.key === "graduation" ? " — revenue outside graduation work remains limited" : ""}.`,
      metric: "Revenue share by service",
      period: periodLabel,
      baseline: "share of period total",
      drill: { kind: "service", value: topService.key },
    });
  }

  // School leaders: top revenue vs top average booking value
  const namedSchools = schools.filter(s => s.key !== "unlinked" && s.key !== "other");
  const topSchool = namedSchools[0];
  if (topSchool) {
    const bestAvg = [...namedSchools]
      .filter(s => s.bookings > 0)
      .sort((a, b) => b.avgBookingCents - a.avgBookingCents)[0];
    const avgNote = bestAvg && bestAvg.key !== topSchool.key
      ? `, while ${schoolLabel(bestAvg.key)} had the highest average booking value (${fmtMoney(bestAvg.avgBookingCents)})`
      : "";
    out.push({
      id: "school-leader",
      text: `${schoolLabel(topSchool.key)} generated the most revenue (${fmtMoney(topSchool.cents)} across ${topSchool.bookings} booking${topSchool.bookings === 1 ? "" : "s"})${avgNote}.`,
      metric: "Revenue by school",
      period: periodLabel,
      baseline: "ranked within period",
      drill: { kind: "school", value: topSchool.key },
    });
  }

  // Client concentration
  const top5Share = clients.slice(0, 5).reduce((s, c) => s + c.share, 0);
  if (clients.length > 5 && top5Share >= CONCENTRATION_WARNING) {
    out.push({
      id: "client-concentration",
      text: `Your top 5 clients account for ${fmtShare(top5Share)} of collected revenue — a concentration risk if any of them churn.`,
      metric: "Top-5 client revenue share",
      period: periodLabel,
      baseline: `${fmtShare(CONCENTRATION_WARNING)} warning threshold`,
      drill: { kind: "ledger" },
    });
  }

  // Platform volume
  const topMethod = methods[0];
  if (topMethod && methods.length > 1) {
    out.push({
      id: "platform-volume",
      text: `${topMethod.key} handled the largest payment volume: ${fmtMoney(topMethod.cents)} across ${topMethod.count} transactions (${fmtShare(topMethod.share)} of collected revenue).`,
      metric: "Revenue by payment platform",
      period: periodLabel,
      baseline: "share of period total",
      drill: { kind: "method", value: topMethod.key },
    });
  }

  // Outstanding balances
  if (receivables.length) {
    const total = receivables.reduce((s, r) => s + r.outstandingCents, 0);
    const overdue = receivables.filter(r => r.bucket === "due1to7" || r.bucket === "due8to30" || r.bucket === "due30plus");
    out.push({
      id: "outstanding",
      text: `${receivables.length} booking${receivables.length === 1 ? " has" : "s have"} an estimated ${fmtMoney(total)} outstanding${overdue.length ? `, ${overdue.length} past the session date` : ""}.`,
      metric: "Estimated outstanding balance",
      period: "all open bookings",
      baseline: "inferred session totals (see receivables panel)",
      drill: { kind: "receivables" },
    });
  }

  // Data quality
  const high = issues.filter(i => i.severity === "high");
  if (high.length) {
    out.push({
      id: "quality",
      text: `${high.length} high-severity data-quality issue${high.length === 1 ? "" : "s"} need review (${[...new Set(high.map(i => i.rule))].join(", ")}) — headline numbers may shift until resolved.`,
      metric: "Data-quality rules",
      period: "entire ledger",
      baseline: "deterministic rules",
      drill: { kind: "quality" },
    });
  }

  return out;
}
