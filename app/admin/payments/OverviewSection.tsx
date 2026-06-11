"use client";
// Executive overview: one dominant collected-revenue metric plus a supporting
// KPI grid. Every number explains its own formula via tooltip and shows an
// honest comparison (or "No prior-period data").

import { fmtMoney, fmtShare } from "@/lib/revenue/format";
import { safeDelta, type PeriodSummary } from "@/lib/revenue/calc";
import { CountUp, DeltaChip, GlassPanel, InfoTip, Skeleton, Sparkline } from "./Glass";
import { REV } from "./palette";

type Props = {
  loading: boolean;
  summary: PeriodSummary;
  prevSummary: PeriodSummary | null;
  sparkValues: number[];
  outstandingCents: number;
  outstandingCount: number;
  collectionRate: number;
  top5ClientShare: number;
  clientCount: number;
  periodLabel: string;
  compareLabel: string | null;
  isSeasonalHigh: boolean;
  onDrillLedger: () => void;
  onDrillReceivables: () => void;
};

export default function OverviewSection({
  loading, summary, prevSummary, sparkValues, outstandingCents, outstandingCount,
  collectionRate, top5ClientShare, clientCount, periodLabel, compareLabel,
  isSeasonalHigh, onDrillLedger, onDrillReceivables,
}: Props) {
  const s = summary;
  const p = prevSummary;
  const collectedDelta = safeDelta(s.collectedCents, p ? p.collectedCents : null);

  const heroStatus = !compareLabel
    ? "No comparison period selected"
    : collectedDelta.kind === "none" || collectedDelta.kind === "zero"
      ? "Insufficient comparison data"
      : isSeasonalHigh
        ? "New seasonal high"
        : collectedDelta.kind === "new" || collectedDelta.ratio >= 0
          ? `Above ${compareLabel}`
          : `Below ${compareLabel}`;

  const kpis: {
    label: string; cents?: number; text?: string; prev?: number | null;
    tip: string; sub?: string; color?: string; onClick?: () => void; invert?: boolean;
  }[] = [
    {
      label: "Outstanding (est.)", cents: outstandingCents, prev: null, color: REV.amber,
      sub: outstandingCount ? `${outstandingCount} open booking${outstandingCount === 1 ? "" : "s"}` : "nothing open",
      tip: "Σ inferred session total − collected, per booking with payments on record. Totals inferred from a single retainer are estimates. Never counted as collected revenue.",
      onClick: onDrillReceivables,
    },
    {
      label: "Avg booking value", cents: s.avgBookingCents, prev: p?.avgBookingCents ?? null,
      sub: `${s.uniqueBookings} booking${s.uniqueBookings === 1 ? "" : "s"}`,
      tip: "Collected revenue ÷ distinct bookings in the period (booking = linked inquiry, else client).",
    },
    {
      label: "Paying clients", text: String(s.uniqueClients),
      prev: null, sub: clientCount ? `${clientCount} all-time` : undefined,
      tip: "Distinct payers (by email, falling back to name) with confirmed revenue in the period.",
    },
    {
      label: "Revenue / client", cents: s.perClientCents, prev: p?.perClientCents ?? null,
      tip: "Collected revenue ÷ paying clients in the period.",
    },
    {
      label: "Retainers", cents: s.depositCents, prev: p?.depositCents ?? null, color: REV.violet,
      sub: "deposit 1 payments",
      tip: "Collected revenue where payment type = deposit 1 (booking retainers). Signals future session volume.",
    },
    {
      label: "Balances + full", cents: s.balanceCents + s.fullCents,
      prev: p ? p.balanceCents + p.fullCents : null, color: REV.blue,
      sub: "deposit 2 + full payments",
      tip: "Collected revenue from final balances (deposit 2) and full one-shot payments.",
    },
    {
      label: "Refunds", cents: s.refundCents, prev: p?.refundCents ?? null, color: REV.orange, invert: true,
      sub: s.refundedCount ? `${s.refundedCount} refunded` : "none in period",
      tip: "Refunded payments plus partial refund_cents on active rows. Subtracted from net.",
      onClick: onDrillLedger,
    },
    {
      label: "Collection rate", text: fmtShare(collectionRate),
      prev: null, color: collectionRate >= 0.9 ? REV.accent : REV.amber,
      tip: "Collected ÷ (collected + estimated outstanding). 100% means no estimated balances are open.",
    },
    {
      label: "Top-5 client share", text: fmtShare(top5ClientShare),
      prev: null, color: top5ClientShare >= 0.6 ? REV.orange : REV.text,
      sub: top5ClientShare >= 0.6 ? "concentration risk" : "healthy spread",
      tip: "Share of the period's collected revenue produced by the five highest-paying clients.",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Hero: collected revenue */}
      <GlassPanel className="lg:col-span-5 p-5 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: REV.glowA }} />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] flex items-center gap-1.5" style={{ color: REV.accent }}>
            Collected revenue · {periodLabel}
            <InfoTip text="Σ amounts of active, confirmed payments in the period (voided excluded, refunded excluded, unverified auto-imports excluded). Date of record = paid date, else session date." />
          </p>
          {loading ? <Skeleton className="h-12 w-48 mt-2" /> : (
            <button type="button" onClick={onDrillLedger} title="Show the transactions behind this number"
              className="block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg">
              <CountUp cents={s.collectedCents} className="text-5xl font-black tracking-tight" color={REV.text} />
            </button>
          )}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <DeltaChip delta={collectedDelta} compareLabel={compareLabel} />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: REV.neutralBg, color: REV.textSoft }}>
              {heroStatus}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
            <div className="flex gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: REV.textFaint }}>Payments</p>
                <p className="text-lg font-black" style={{ color: REV.text }}>{loading ? "—" : s.paymentCount}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: REV.textFaint }}>
                  Avg payment <InfoTip text="Collected revenue ÷ number of confirmed payments in the period." />
                </p>
                <p className="text-lg font-black" style={{ color: REV.text }}>{loading ? "—" : fmtMoney(s.avgPaymentCents)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: REV.textFaint }}>
                  Net <InfoTip text="Collected − processing fees − refunds (refund-adjusted net revenue)." />
                </p>
                <p className="text-lg font-black" style={{ color: REV.accent }}>{loading ? "—" : fmtMoney(s.netCents)}</p>
              </div>
            </div>
            {sparkValues.length > 1 && <Sparkline values={sparkValues} width={140} height={36} />}
          </div>
        </div>
      </GlassPanel>

      {/* Secondary KPIs */}
      <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map(k => {
          const delta = k.prev !== undefined && k.cents !== undefined ? safeDelta(k.cents, k.prev) : null;
          const inner = (
            <>
              <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5" style={{ color: REV.textFaint }}>
                {k.label} <InfoTip text={k.tip} />
              </p>
              {loading ? <Skeleton className="h-7 w-20" /> : k.cents !== undefined
                ? <CountUp cents={k.cents} className="text-xl font-black" color={k.color ?? REV.text} />
                : <span className="text-xl font-black" style={{ color: k.color ?? REV.text }}>{k.text}</span>}
              <div className="mt-1 min-h-[16px]">
                {delta && delta.kind !== "none"
                  ? <DeltaChip delta={delta} compareLabel={compareLabel} invert={k.invert} />
                  : k.sub
                    ? <p className="text-[10px] font-bold" style={{ color: REV.textFaint }}>{k.sub}</p>
                    : delta && <DeltaChip delta={delta} compareLabel={compareLabel} />}
              </div>
            </>
          );
          return (
            <GlassPanel key={k.label} hoverable className="p-3.5">
              {k.onClick ? (
                <button type="button" onClick={k.onClick} className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg">
                  {inner}
                </button>
              ) : inner}
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}
