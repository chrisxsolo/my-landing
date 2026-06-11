"use client";
// Revenue composition: where money comes from. Service mix (donut), ranked
// schools, payment-platform mix ($ vs transaction count), deposit-vs-final
// cash-flow split, and concentration analysis. Every bar drills the dashboard.

import { useMemo } from "react";
import { fmtMoney, fmtShare } from "@/lib/revenue/format";
import { breakdownBy, safeDelta, topShare, type BreakdownEntry } from "@/lib/revenue/calc";
import { SERVICE_LABELS, type LedgerRow, type ServiceKey } from "@/lib/revenue/enrich";
import { schoolLabel } from "@/lib/revenue/schools";
import { normalizePaymentMethod } from "@/lib/paymentFilters";
import { DeltaChip, EmptyState, GlassPanel, InfoTip, SectionHeader, Skeleton, useReducedMotion } from "./Glass";
import { METHOD_META, REV, SERIES_COLORS, SERVICE_COLORS } from "./palette";
import type { RevenueFilters } from "./state";

type Props = {
  loading: boolean;
  periodRows: LedgerRow[];
  compRows: LedgerRow[] | null;
  compareLabel: string | null;
  collectedCents: number;
  onDrill: (patch: Partial<RevenueFilters>) => void;
};

export default function CompositionSection({ loading, periodRows, compRows, compareLabel, collectedCents, onDrill }: Props) {
  const services = useMemo(() => breakdownBy(periodRows, p => p.serviceKey), [periodRows]);
  const schools = useMemo(() => breakdownBy(periodRows, p => p.schoolKey), [periodRows]);
  const compSchools = useMemo(() => (compRows ? breakdownBy(compRows, p => p.schoolKey) : null), [compRows]);
  const methods = useMemo(() => breakdownBy(periodRows, p => normalizePaymentMethod(p.method)), [periodRows]);
  const types = useMemo(() => breakdownBy(periodRows, p => p.payment_type || "other"), [periodRows]);
  const clients = useMemo(() => breakdownBy(periodRows, p => (p.client_email || p.client_name).toLowerCase()), [periodRows]);

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <GlassPanel key={i} className="p-5"><Skeleton className="h-40 w-full" /></GlassPanel>)}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Service mix */}
      <GlassPanel className="p-5">
        <SectionHeader kicker="Composition" title="Revenue by service" />
        {services.length === 0 ? <EmptyState message="No revenue in this period." /> : (
          <div className="flex items-center gap-5">
            <Donut entries={services} colorOf={k => SERVICE_COLORS[k] ?? REV.neutral} />
            <div className="flex-1 space-y-2 min-w-0">
              {services.map(s => (
                <button key={s.key} type="button" onClick={() => onDrill({ service: s.key })}
                  className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md"
                  title={`${s.bookings} bookings · avg ${fmtMoney(s.avgBookingCents)} — click to filter`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold truncate group-hover:underline" style={{ color: REV.text }}>
                      <span aria-hidden className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SERVICE_COLORS[s.key] ?? REV.neutral }} />
                      {SERVICE_LABELS[s.key as ServiceKey] ?? s.key}
                    </span>
                    <span className="text-xs font-black flex-shrink-0" style={{ color: REV.text }}>{fmtMoney(s.cents)}</span>
                  </div>
                  <p className="text-[10px] font-bold pl-3.5" style={{ color: REV.textFaint }}>
                    {fmtShare(s.share)} · {s.bookings} booking{s.bookings === 1 ? "" : "s"} · avg {fmtMoney(s.avgBookingCents)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Schools */}
      <GlassPanel className="p-5">
        <SectionHeader kicker="Composition" title="Revenue by school" accent={REV.violet}
          right={<InfoTip text="Schools are detected from the linked inquiry's school/location fields (with message text as fallback). Payments without a linked inquiry can't be attributed." />} />
        {schools.length === 0 ? <EmptyState message="No revenue in this period." /> : (
          <RankedBars
            entries={schools.slice(0, 8)}
            labelOf={schoolLabel}
            color={REV.violet}
            subOf={e => {
              const prev = compSchools?.find(c => c.key === e.key);
              return (
                <span className="inline-flex items-center gap-2">
                  {fmtShare(e.share)} · {e.clients} client{e.clients === 1 ? "" : "s"} · avg {fmtMoney(e.avgBookingCents)}
                  {compareLabel && <DeltaChip delta={safeDelta(e.cents, prev ? prev.cents : 0)} compareLabel={compareLabel} />}
                </span>
              );
            }}
            onClick={e => onDrill({ school: e.key })}
          />
        )}
      </GlassPanel>

      {/* Concentration */}
      <GlassPanel className="p-5">
        <SectionHeader kicker="Risk" title="Revenue concentration" accent={REV.amber}
          right={<InfoTip text="Share of the period's collected revenue from the top source in each dimension. Sustained shares above 60% mean one cancellation or season can sink the period." />} />
        <div className="space-y-3">
          <ConcentrationRow label="Top 5 clients" share={topShare(clients, 5)} detail={`${Math.min(5, clients.length)} of ${clients.length} payers`} />
          <ConcentrationRow label={`Top school — ${schools[0] ? schoolLabel(schools[0].key) : "n/a"}`} share={schools[0]?.share ?? 0} detail={schools[0] ? fmtMoney(schools[0].cents) : "no data"} />
          <ConcentrationRow label={`Top service — ${services[0] ? SERVICE_LABELS[services[0].key as ServiceKey] ?? services[0].key : "n/a"}`} share={services[0]?.share ?? 0} detail={services[0] ? fmtMoney(services[0].cents) : "no data"} />
          <ConcentrationRow label={`Top platform — ${methods[0] ? (METHOD_META[methods[0].key]?.label ?? methods[0].key) : "n/a"}`} share={methods[0]?.share ?? 0} detail={methods[0] ? fmtMoney(methods[0].cents) : "no data"} />
        </div>
      </GlassPanel>

      {/* Platform mix */}
      <GlassPanel className="p-5 md:col-span-1">
        <SectionHeader kicker="Composition" title="Payment platform mix" accent={REV.blue}
          right={<InfoTip text="Dollar volume and transaction count per platform — count share and revenue share are different things, so both are shown." />} />
        {methods.length === 0 ? <EmptyState message="No revenue in this period." /> : (
          <RankedBars
            entries={methods}
            labelOf={k => METHOD_META[k]?.label ?? k}
            colorOf={k => METHOD_META[k]?.color ?? REV.neutral}
            subOf={e => `${fmtShare(e.share)} of $ · ${e.count} txn${e.count === 1 ? "" : "s"} (${fmtShare(e.count / Math.max(1, methods.reduce((s, m) => s + m.count, 0)))} of count)`}
            onClick={e => onDrill({ method: e.key })}
          />
        )}
      </GlassPanel>

      {/* Deposit vs final mix */}
      <GlassPanel className="p-5 md:col-span-2 xl:col-span-2">
        <SectionHeader kicker="Cash-flow timing" title="Retainers vs balances vs full payments" accent={REV.pink}
          right={<InfoTip text="When cash actually arrives: retainers at booking (deposit 1), balances at delivery (deposit 2), full payments in one shot. Refunds shown for completeness." />} />
        {collectedCents <= 0 ? <EmptyState message="No revenue in this period." /> : (
          <StackedTypeBar types={types} totalCents={collectedCents} />
        )}
      </GlassPanel>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Donut({ entries, colorOf }: { entries: BreakdownEntry[]; colorOf: (key: string) => string }) {
  const reduced = useReducedMotion();
  const R = 40;
  const CIRC = 2 * Math.PI * R;
  // Precompute each segment's start offset (cumulative share before it).
  const segments = entries.map((e, i) => ({
    entry: e,
    startShare: entries.slice(0, i).reduce((s, prev) => s + prev.share, 0),
  }));
  return (
    <svg width={110} height={110} viewBox="0 0 110 110" role="img"
      aria-label={`Service mix: ${entries.map(e => `${e.key} ${fmtShare(e.share)}`).join(", ")}`}>
      <circle cx={55} cy={55} r={R} fill="none" stroke={REV.inset} strokeWidth={14} />
      {segments.map(({ entry: e, startShare }) => {
        const dash = e.share * CIRC;
        return (
          <circle key={e.key} cx={55} cy={55} r={R} fill="none"
            stroke={colorOf(e.key)} strokeWidth={14}
            strokeDasharray={`${dash} ${CIRC - dash}`} strokeDashoffset={-startShare * CIRC}
            transform="rotate(-90 55 55)"
            style={reduced ? undefined : { transition: "stroke-dasharray 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
        );
      })}
      <text x={55} y={52} textAnchor="middle" fontSize={11} fontWeight={900} fill={REV.text}>
        {entries.length}
      </text>
      <text x={55} y={64} textAnchor="middle" fontSize={8} fontWeight={700} fill={REV.textFaint}>
        service{entries.length === 1 ? "" : "s"}
      </text>
    </svg>
  );
}

function RankedBars({ entries, labelOf, subOf, onClick, color, colorOf }: {
  entries: BreakdownEntry[];
  labelOf: (key: string) => string;
  subOf: (e: BreakdownEntry) => React.ReactNode;
  onClick: (e: BreakdownEntry) => void;
  color?: string;
  colorOf?: (key: string) => string;
}) {
  const max = entries[0]?.cents ?? 1;
  return (
    <div className="space-y-2.5">
      {entries.map((e, i) => {
        const barColor = colorOf?.(e.key) ?? color ?? SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <button key={e.key} type="button" onClick={() => onClick(e)}
            className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md"
            title="Filter the dashboard to these payments">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold truncate group-hover:underline" style={{ color: REV.text }}>{labelOf(e.key)}</span>
              <span className="text-xs font-black flex-shrink-0" style={{ color: barColor }}>{fmtMoney(e.cents)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: REV.inset }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(e.cents / max) * 100}%`, background: barColor }} />
            </div>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: REV.textFaint }}>{subOf(e)}</p>
          </button>
        );
      })}
    </div>
  );
}

function ConcentrationRow({ label, share, detail }: { label: string; share: number; detail: string }) {
  const risky = share >= 0.6;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-bold truncate" style={{ color: REV.textSoft }}>{label}</span>
        <span className="text-xs font-black inline-flex items-center gap-1.5" style={{ color: risky ? REV.orange : REV.text }}>
          {fmtShare(share)}
          {risky && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: REV.orangeBg, color: REV.orange }}>⚠ concentrated</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: REV.inset }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share * 100}%`, background: risky ? REV.orange : REV.accent }} />
      </div>
      <p className="text-[10px] font-bold mt-0.5" style={{ color: REV.textFaint }}>{detail}</p>
    </div>
  );
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  deposit_1: { label: "Retainers", color: REV.violet },
  deposit_2: { label: "Balances", color: REV.blue },
  full: { label: "Full payments", color: REV.accent },
  other: { label: "Other", color: REV.neutral },
};

function StackedTypeBar({ types, totalCents }: { types: BreakdownEntry[]; totalCents: number }) {
  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden" style={{ background: REV.inset }} role="img"
        aria-label={types.map(t => `${TYPE_META[t.key]?.label ?? t.key}: ${fmtMoney(t.cents)} (${fmtShare(t.share)})`).join(", ")}>
        {types.map(t => (
          <div key={t.key} style={{ width: `${(t.cents / totalCents) * 100}%`, background: TYPE_META[t.key]?.color ?? REV.neutral }} />
        ))}
      </div>
      <div className="flex gap-5 mt-3 flex-wrap">
        {types.map(t => {
          const meta = TYPE_META[t.key] ?? { label: t.key, color: REV.neutral };
          return (
            <div key={t.key} title={`${t.count} payments`}>
              <p className="text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5" style={{ color: REV.textFaint }}>
                <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: meta.color }} />{meta.label}
              </p>
              <p className="text-base font-black" style={{ color: REV.text }}>{fmtMoney(t.cents)}</p>
              <p className="text-[10px] font-bold" style={{ color: REV.textFaint }}>{fmtShare(t.share)} · {t.count} payment{t.count === 1 ? "" : "s"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
