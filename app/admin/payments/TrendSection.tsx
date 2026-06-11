"use client";
// Revenue trends: the main interactive time series with granularity + metric
// toggles and comparison overlay, the running pace module, and the
// month×year seasonality heatmap.

import { useMemo, useState } from "react";
import type { PaymentPeriod } from "@/lib/paymentAnalytics";
import { fmtMoney, fmtShare } from "@/lib/revenue/format";
import type { LedgerRow } from "@/lib/revenue/enrich";
import {
  autoGranularity,
  bucketSeries,
  monthlyHeatmap,
  toCumulative,
  type Pace,
  type SeriesPoint,
} from "@/lib/revenue/series";
import { CountUp, EmptyState, GlassPanel, InfoTip, SectionHeader, Skeleton } from "./Glass";
import { REV } from "./palette";
import TrendChart from "./TrendChart";

type MetricKey = "collected" | "deposits" | "balances" | "refunds";
type GranKey = "day" | "week" | "month" | "cumulative";

const METRICS: { key: MetricKey; label: string; color: string; tip: string }[] = [
  { key: "collected", label: "Collected", color: REV.accent, tip: "All confirmed active revenue in the period." },
  { key: "deposits", label: "Retainers", color: REV.violet, tip: "Deposit 1 payments only — leading indicator of booked sessions." },
  { key: "balances", label: "Balances + full", color: REV.blue, tip: "Deposit 2 and full payments — cash collected at delivery." },
  { key: "refunds", label: "Refunds", color: REV.orange, tip: "Refunded payments, shown as positive amounts returned." },
];

function metricRows(rows: LedgerRow[], metric: MetricKey): { rows: LedgerRow[]; confirmed: boolean } {
  if (metric === "deposits") return { rows: rows.filter(p => p.payment_type === "deposit_1"), confirmed: true };
  if (metric === "balances") return { rows: rows.filter(p => p.payment_type === "deposit_2" || p.payment_type === "full"), confirmed: true };
  if (metric === "refunds") return { rows: rows.filter(p => p.status === "refunded"), confirmed: false };
  return { rows, confirmed: true };
}

type Props = {
  loading: boolean;
  periodRows: LedgerRow[];
  compRows: LedgerRow[] | null;
  period: PaymentPeriod;
  compPeriod: PaymentPeriod | null;
  allRows: LedgerRow[]; // unscoped by period, for the heatmap
  pace: Pace;
};

export default function TrendSection({ loading, periodRows, compRows, period, compPeriod, allRows, pace }: Props) {
  const [metric, setMetric] = useState<MetricKey>("collected");
  const [gran, setGran] = useState<GranKey | "auto">("auto");

  const baseGran = gran === "auto" || gran === "cumulative" ? autoGranularity(period) : gran;
  const meta = METRICS.find(m => m.key === metric)!;

  const { points, compPoints } = useMemo(() => {
    const cur = metricRows(periodRows, metric);
    let points = bucketSeries(cur.rows, period, baseGran, cur.confirmed);
    let compPoints: SeriesPoint[] | null = null;
    if (compRows && compPeriod) {
      const cmp = metricRows(compRows, metric);
      compPoints = bucketSeries(cmp.rows, compPeriod, baseGran, cmp.confirmed);
    }
    if (gran === "cumulative") {
      points = toCumulative(points);
      compPoints = compPoints ? toCumulative(compPoints) : null;
    }
    return { points, compPoints };
  }, [periodRows, compRows, period, compPeriod, metric, baseGran, gran]);

  const heatCells = useMemo(() => monthlyHeatmap(allRows), [allRows]);
  const heatYears = [...new Set(heatCells.map(c => c.year))].sort();
  const heatMax = Math.max(...heatCells.map(c => c.cents), 1);
  const heatTotal = heatCells.reduce((s, c) => s + c.cents, 0);
  const gradMonthsCents = heatCells.filter(c => c.month >= 2 && c.month <= 5).reduce((s, c) => s + c.cents, 0);

  const total = points.reduce((s, p) => s + (gran === "cumulative" ? 0 : p.cents), 0)
    + (gran === "cumulative" && points.length ? points[points.length - 1].cents : 0);

  const toggle = (
    label: string, value: string, options: { v: string; l: string }[], onSel: (v: string) => void,
  ) => (
    <div className="flex gap-0.5 p-0.5 rounded-lg" role="group" aria-label={label}
      style={{ background: REV.inset, border: `1px solid ${REV.panelBorder}` }}>
      {options.map(({ v, l }) => (
        <button key={v} type="button" onClick={() => onSel(v)} aria-pressed={value === v}
          className="px-2 py-1 rounded-md text-[10px] font-black transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          style={value === v ? { background: REV.accentBg, color: REV.accent } : { color: REV.textSoft }}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Main trend chart */}
      <GlassPanel className="xl:col-span-8 p-5">
        <SectionHeader kicker="Revenue trends" title={`${meta.label} over time`}
          right={
            <div className="flex items-center gap-2 flex-wrap">
              {toggle("Metric", metric, METRICS.map(m => ({ v: m.key, l: m.label })), v => setMetric(v as MetricKey))}
              {toggle("Granularity", gran, [
                { v: "auto", l: `Auto (${baseGran})` }, { v: "day", l: "Daily" }, { v: "week", l: "Weekly" },
                { v: "month", l: "Monthly" }, { v: "cumulative", l: "Cumulative" },
              ], v => setGran(v as GranKey | "auto"))}
            </div>
          } />
        {loading ? <Skeleton className="h-56 w-full" /> : (
          <>
            <TrendChart
              points={points}
              compPoints={compPoints}
              compareLabel={compPeriod?.label ?? null}
              metricLabel={gran === "cumulative" ? `${meta.label} (cumulative)` : meta.label}
              color={meta.color}
              summaryForA11y={`${meta.label} for ${period.label}: ${fmtMoney(total)} across ${points.reduce((s, p) => s + p.count, 0)} payments${compPeriod ? `, compared against ${compPeriod.label}` : ""}.`}
            />
            <div className="flex items-center gap-4 mt-2 flex-wrap text-[10px] font-bold" style={{ color: REV.textSoft }}>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-4 h-0.5 rounded-full" style={{ background: meta.color }} /> {period.label}
              </span>
              {compPeriod && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="w-4 border-t border-dashed" style={{ borderColor: REV.neutral }} /> {compPeriod.label}
                </span>
              )}
              <span style={{ color: REV.textFaint }}>{fmtMoney(total)} total in view</span>
              <InfoTip text={meta.tip} />
            </div>
          </>
        )}
      </GlassPanel>

      <div className="xl:col-span-4 grid grid-cols-1 gap-4">
        {/* Pace */}
        <GlassPanel className="p-5">
          <SectionHeader kicker="Running pace" title="Where this period is heading" accent={REV.violet} />
          {loading ? <Skeleton className="h-24 w-full" /> : (
            <div className="space-y-3">
              <PaceRow label={`Collected so far (${Math.round(pace.elapsed * 100)}% elapsed)`} cents={pace.soFarCents} color={REV.accent} max={paceMax(pace)} />
              {pace.compAtSamePointCents !== null ? (
                <PaceRow label="Comparison period at the same point" cents={pace.compAtSamePointCents} color={REV.neutral} max={paceMax(pace)} />
              ) : (
                <p className="text-[10px] font-bold" style={{ color: REV.textFaint }}>No prior-period data for pace comparison.</p>
              )}
              {pace.compTotalCents !== null && (
                <PaceRow label="Comparison period final total" cents={pace.compTotalCents} color={REV.textFaint} max={paceMax(pace)} />
              )}
              {pace.projectedCents !== null ? (
                <div className="pt-2 mt-1" style={{ borderTop: `1px dashed ${REV.panelBorder}` }}>
                  <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: REV.amber }}>
                    Estimated end-of-period <InfoTip text="Linear pace estimate: collected so far ÷ fraction of the period elapsed. A statistical estimate — not booked or guaranteed income." />
                  </p>
                  <CountUp cents={pace.projectedCents} className="text-2xl font-black" color={REV.amber} />
                  <p className="text-[10px] font-bold" style={{ color: REV.textFaint }}>estimate · assumes current pace continues</p>
                </div>
              ) : (
                <p className="text-[10px] font-bold" style={{ color: REV.textFaint }}>
                  {pace.elapsed >= 1 ? "Period complete — no projection needed." : "Too early in the period to project."}
                </p>
              )}
            </div>
          )}
        </GlassPanel>

        {/* Seasonality heatmap */}
        <GlassPanel className="p-5">
          <SectionHeader kicker="Seasonality" title="Revenue by month" accent={REV.amber} />
          {loading ? <Skeleton className="h-24 w-full" /> : heatCells.length === 0 ? (
            <EmptyState message="No dated revenue yet." />
          ) : (
            <>
              <div role="img" aria-label={`Monthly revenue heatmap. ${heatYears.map(y => `${y}: ` + heatCells.filter(c => c.year === y).map(c => `${MONTHS[c.month]} ${fmtMoney(c.cents)}`).join(", ")).join(". ")}`}>
                <div className="grid gap-1" style={{ gridTemplateColumns: "auto repeat(12, minmax(0,1fr))" }}>
                  <span />
                  {MONTHS.map(m => (
                    <span key={m} className="text-[8px] font-black text-center uppercase" style={{ color: REV.textFaint }}>{m[0]}</span>
                  ))}
                  {heatYears.map(year => (
                    <YearRow key={year} year={year} cells={heatCells.filter(c => c.year === year)} max={heatMax} />
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-bold mt-3 leading-relaxed" style={{ color: REV.textSoft }}>
                {fmtShare(heatTotal > 0 ? gradMonthsCents / heatTotal : 0)} of all-time revenue lands in March–June
                {heatTotal > 0 && gradMonthsCents / heatTotal >= 0.6 ? " — heavily graduation-season concentrated." : "."}
              </p>
            </>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function paceMax(pace: Pace): number {
  return Math.max(pace.soFarCents, pace.compTotalCents ?? 0, pace.projectedCents ?? 0, 1);
}

function PaceRow({ label, cents, color, max }: { label: string; cents: number; color: string; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-bold" style={{ color: REV.textSoft }}>{label}</span>
        <span className="text-xs font-black" style={{ color }}>{fmtMoney(cents)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: REV.inset }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(cents / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function YearRow({ year, cells, max }: { year: number; cells: { month: number; cents: number; count: number }[]; max: number }) {
  const byMonth = new Map(cells.map(c => [c.month, c]));
  return (
    <>
      <span className="text-[9px] font-black pr-1 self-center" style={{ color: REV.textSoft }}>{year}</span>
      {MONTHS.map((_, m) => {
        const cell = byMonth.get(m);
        const intensity = cell ? Math.max(0.12, cell.cents / max) : 0;
        return (
          <div key={m} title={cell ? `${MONTHS[m]} ${year}: ${fmtMoney(cell.cents)} (${cell.count} payments)` : `${MONTHS[m]} ${year}: no revenue`}
            className="aspect-square rounded-[4px]"
            style={{
              background: cell ? `rgba(52,211,153,${(0.15 + intensity * 0.85).toFixed(2)})` : "rgba(148,163,184,0.07)",
              border: `1px solid ${cell ? "rgba(52,211,153,0.25)" : "transparent"}`,
            }} />
        );
      })}
    </>
  );
}
