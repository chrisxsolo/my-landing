"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { C } from "@/lib/colors";
import {
  buildMonthPeriod,
  buildRelativePeriod,
  filterRevenuePayments,
  paymentMatchesPeriod,
  type RevenuePeriod,
} from "@/lib/paymentAnalytics";
import {
  DEFAULT_PAYMENT_FILTERS,
  normalizePaymentMethod,
  type PaymentFilterState,
  type PaymentRow,
} from "@/lib/paymentFilters";
import TransactionsPanel, { METHOD_META, fmtMoney } from "./payments/TransactionsPanel";
import ReviewQueuePanel from "./payments/ReviewQueuePanel";
import { AnimBar, BarCol, MoneyUp } from "./payments/ChartBits";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

function parseCents(amount: string): number {
  if (!amount) return 0;
  const m = amount.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!m) return 0;
  return Math.round(parseFloat(m[0].replace(",", "")) * 100);
}

const rowCents = (p: PaymentRow) => p.amount_cents || parseCents(p.amount);

export default function PaymentAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [lastReconciledAt, setLastReconciledAt] = useState<string | null>(null);
  const [period, setPeriod] = useState<RevenuePeriod>("thisYear");
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [hoverBar, setHoverBar] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [filters, setFilters] = useState<PaymentFilterState>(DEFAULT_PAYMENT_FILTERS);
  const [stagingReloadToken, setStagingReloadToken] = useState(0);
  const txRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      const json = await res.json() as { payments?: PaymentRow[]; lastReconciledAt?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load payments");
      setPayments(json.payments ?? []);
      setLastReconciledAt(json.lastReconciledAt ?? null);
    } catch (err) {
      console.error("[PaymentAnalyticsTab] load payments failed:", err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activePeriod = selectedMonth
    ? buildMonthPeriod(selectedMonth.year, selectedMonth.month)
    : buildRelativePeriod(period);
  const periodLabel = activePeriod.label;

  async function syncSelectedPayments() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const body = selectedMonth
        ? { year: selectedMonth.year, month: selectedMonth.month + 1 }
        : {};
      const res = await fetch("/api/sync-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { total?: number; error?: string };
      if (!res.ok) {
        setSyncMessage(json.error ?? "Claude payment audit failed.");
        return;
      }
      setStagingReloadToken(t => t + 1);
      setSyncMessage(`Claude found ${json.total ?? 0} payment${json.total === 1 ? "" : "s"} awaiting your review below.`);
    } catch {
      setSyncMessage("Claude payment audit failed.");
    } finally {
      setSyncing(false);
    }
  }

  // Drill-down: every headline number sets the transaction filters and jumps
  // to the list, so the rows that produce the number are always one click away.
  function drill(patch: Partial<PaymentFilterState>) {
    setFilters({ ...DEFAULT_PAYMENT_FILTERS, ...patch });
    txRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // All rows in the selected period (any status) — what the transaction panel sees
  const periodRows = payments.filter(p => paymentMatchesPeriod(p, activePeriod));
  // Confirmed active revenue rows in the period — what the metrics count
  const revenueRows = filterRevenuePayments(periodRows);
  const refundedRows = periodRows.filter(p => p.status === "refunded");

  const collectedCents = revenueRows.reduce((s, p) => s + rowCents(p), 0);
  const feeCents = revenueRows.reduce((s, p) => s + (p.fee_cents || 0), 0);
  const refundCents = refundedRows.reduce((s, p) => s + rowCents(p), 0)
    + revenueRows.reduce((s, p) => s + (p.refund_cents || 0), 0);
  const netCents = collectedCents - feeCents - refundCents;
  const paymentCount = revenueRows.length;
  const avgCents = paymentCount > 0 ? Math.round(collectedCents / paymentCount) : 0;
  const uniqueClients = new Set(revenueRows.map(p => (p.client_email || p.client_name).toLowerCase())).size;
  const avgPerClientCents = uniqueClients > 0 ? Math.round(collectedCents / uniqueClients) : 0;

  // Monthly chart (last 12 months, confirmed active only)
  const activePayments = filterRevenuePayments(payments);
  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthPeriod = buildMonthPeriod(d.getFullYear(), d.getMonth());
    const items = activePayments.filter(p => paymentMatchesPeriod(p, monthPeriod));
    const cents = items.reduce((s, p) => s + rowCents(p), 0);
    return {
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(), month: d.getMonth(), cents, count: items.length,
      isCurrentMonth: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
    };
  });
  const maxMonthCents = Math.max(...monthlyData.map(m => m.cents), 1);

  function breakdown(keyOf: (p: PaymentRow) => string) {
    const map = new Map<string, { cents: number; count: number }>();
    revenueRows.forEach(p => {
      const key = keyOf(p);
      const entry = map.get(key) ?? { cents: 0, count: 0 };
      map.set(key, { cents: entry.cents + rowCents(p), count: entry.count + 1 });
    });
    return [...map.entries()].sort((a, b) => b[1].cents - a[1].cents);
  }

  const methodBreakdown = breakdown(p => normalizePaymentMethod(p.method));
  const typeBreakdown = breakdown(p => p.payment_type || "other");
  const serviceBreakdown = breakdown(p => p.inquiry_session_type || "unlinked");
  const maxType = typeBreakdown[0]?.[1].cents ?? 1;
  const maxService = serviceBreakdown[0]?.[1].cents ?? 1;

  const statCards: { label: string; node: React.ReactNode; sub: string; patch: Partial<PaymentFilterState> }[] = [
    { label: "Collected", node: <MoneyUp target={collectedCents} className="text-2xl font-black" color="#10b981" />, sub: periodLabel, patch: {} },
    { label: "Refunds", node: <MoneyUp target={refundCents} className="text-2xl font-black" color="#d97706" />, sub: refundedRows.length ? `${refundedRows.length} refunded` : "none", patch: { status: "refunded" } },
    { label: "Net Collected", node: <MoneyUp target={netCents} className="text-2xl font-black" color="#059669" />, sub: feeCents ? `after ${fmtMoney(feeCents)} fees` : "after fees & refunds", patch: { status: "" } },
    { label: "Payments", node: <span className="text-2xl font-black" style={{ color: C.p1 }}>{paymentCount}</span>, sub: `${uniqueClients} client${uniqueClients === 1 ? "" : "s"}`, patch: {} },
    { label: "Avg Payment", node: <MoneyUp target={avgCents} className="text-2xl font-black" color="#d97706" />, sub: paymentCount ? `across ${paymentCount}` : "no data", patch: {} },
    { label: "Avg per Client", node: <MoneyUp target={avgPerClientCents} className="text-2xl font-black" color="#6366f1" />, sub: uniqueClients ? `${uniqueClients} unique payers` : "no data", patch: {} },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#34d399,#6ee7b7)" }} />
        <div className="p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: "#10b981" }}>Payment Analytics</p>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Revenue from your sessions.</h2>
            <p className="mt-1 text-sm text-slate-400 font-medium">
              Gmail finds payments · you approve them · the ledger stays clean.
            </p>
            {lastReconciledAt && (
              <p className="mt-1 text-xs font-bold" style={{ color: "#10b981" }}>
                ✓ Last reconciled {new Date(lastReconciledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-50 border border-slate-100">
              {([
                { v: "thisMonth" as RevenuePeriod, l: "This Mo." },
                { v: "lastMonth" as RevenuePeriod, l: "Last Mo." },
                { v: "thisYear"  as RevenuePeriod, l: "This Year" },
                { v: "all"       as RevenuePeriod, l: "All Time" },
              ]).map(({ v, l }) => (
                <button key={v} onClick={() => { setPeriod(v); setSelectedMonth(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                  style={!selectedMonth && period === v ? { background: "rgba(16,185,129,0.12)", color: "#10b981" } : { color: "#94a3b8" }}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading}
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
            <Link href="/admin/manual-payments" target="_blank" rel="noopener noreferrer"
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80 text-center"
              style={{ background: C.p1_08, color: C.p1 }}>
              Manual entry table
            </Link>
            <button onClick={syncSelectedPayments} disabled={syncing}
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: C.grad12, color: C.white }}>
              {syncing ? "Claude checking…" : selectedMonth ? `Claude audit ${periodLabel}` : "Claude audit payments"}
            </button>
            {syncMessage && (
              <p className="text-[10px] font-bold max-w-[260px] text-right" style={{ color: C.muted }}>
                {syncMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Review queue (staged imports + duplicate suspects) ── */}
      <ReviewQueuePanel
        activeRows={payments}
        reloadToken={stagingReloadToken}
        onLedgerChanged={load}
      />

      {/* ── Stat cards — click any number to see exactly which rows produce it ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ label, node, sub, patch }) => (
          <button key={label} type="button" onClick={() => drill(patch)}
            className={`${card} text-left transition-all hover:shadow-md cursor-pointer`}
            title="Show the transactions behind this number">
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#34d399)" }} />
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
              <div className="mb-1">{node}</div>
              <p className="text-[10px] text-slate-400">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Monthly revenue chart ── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#6ee7b7)" }} />
        <div className="p-6">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#10b981" }}>Monthly Revenue</p>
              <p className="text-sm text-slate-400 font-medium">Last 12 months · click a month to drill in</p>
            </div>
            <p className="text-xs font-bold text-slate-400">
              {fmtMoney(monthlyData.reduce((s, m) => s + m.cents, 0))} total · {monthlyData.reduce((s, m) => s + m.count, 0)} payments
            </p>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="relative flex items-end justify-between gap-1.5 px-1" style={{ height: 160 }}>
              {hoverBar !== null && monthlyData[hoverBar] && (() => {
                const m = monthlyData[hoverBar];
                const centerPct = (hoverBar + 0.5) / 12 * 100;
                return (
                  <div className="absolute pointer-events-none z-20"
                    style={{
                      left: `${centerPct}%`, bottom: "100%", marginBottom: 10,
                      transform: centerPct > 75 ? "translateX(-90%)" : centerPct < 15 ? "translateX(-5%)" : "translateX(-50%)",
                    }}>
                    <div className="rounded-xl px-3 py-2 shadow-xl whitespace-nowrap" style={{ background: "rgba(15,15,25,0.92)" }}>
                      <p className="text-xs font-bold text-white">{m.label} {m.year}</p>
                      <p className="text-sm font-black" style={{ color: "#34d399" }}>{fmtMoney(m.cents)}</p>
                      <p className="text-[10px] text-white/60">{m.count} payment{m.count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="w-2 h-2 rotate-45 mt-[-4px] mx-auto" style={{ background: "rgba(15,15,25,0.92)" }} />
                  </div>
                );
              })()}
              {monthlyData.map((m, i) => {
                const isSelected = selectedMonth?.year === m.year && selectedMonth.month === m.month;
                return (
                <button key={`${m.year}-${m.month}`} type="button"
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer bg-transparent border-0 p-0 rounded-lg"
                  onClick={() => { setSelectedMonth({ year: m.year, month: m.month }); drill({}); }}
                  onMouseEnter={() => setHoverBar(i)} onMouseLeave={() => setHoverBar(null)}
                  aria-label={`Show ${m.label} ${m.year} payments`}
                  style={isSelected ? { outline: "2px solid rgba(16,185,129,0.3)", outlineOffset: 4 } : undefined}>
                  <BarCol pct={(m.cents / maxMonthCents) * 100} isCurrent={m.isCurrentMonth || isSelected} isHov={hoverBar === i || isSelected} delay={i * 40} />
                  <p className="text-[9px] font-black transition-colors"
                    style={{ color: hoverBar === i || isSelected ? "#10b981" : m.isCurrentMonth ? "#10b981" : "#94a3b8" }}>
                    {m.label}
                  </p>
                </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Method / type / service breakdowns — every bar drills into the list ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#a78bfa)" }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "#6366f1" }}>By Payment Method</p>
            {loading ? <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            : methodBreakdown.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">No payments yet.</p>
            : <div className="space-y-4">
                {methodBreakdown.map(([m, { cents, count }], i) => {
                  const meta = METHOD_META[m] ?? METHOD_META.other;
                  return (
                    <button key={m} type="button" onClick={() => drill({ method: m })} className="w-full text-left cursor-pointer">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                          <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{count}</span>
                        </div>
                        <span className="text-sm font-black" style={{ color: meta.color }}>{fmtMoney(cents)}</span>
                      </div>
                      <AnimBar pct={collectedCents > 0 ? (cents / collectedCents) * 100 : 0} color={meta.color} delay={i * 80} />
                    </button>
                  );
                })}
              </div>}
          </div>
        </div>

        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad12 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p1 }}>By Payment Type</p>
            {loading ? <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            : typeBreakdown.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">No data yet.</p>
            : <div className="space-y-4">
                {typeBreakdown.map(([type, { cents }], i) => (
                  <button key={type} type="button" onClick={() => drill({ paymentType: type })} className="w-full text-left cursor-pointer">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700 truncate flex-1 capitalize">{type.replace("_", " ")}</span>
                      <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: C.p1 }}>{fmtMoney(cents)}</span>
                    </div>
                    <AnimBar pct={(cents / maxType) * 100} color={[C.p1, C.p2, C.p3, "#f59e0b", "#10b981"][i % 5]} delay={i * 80} />
                  </button>
                ))}
              </div>}
          </div>
        </div>

        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#fbbf24)" }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "#059669" }}>By Service</p>
            {loading ? <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            : serviceBreakdown.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">No data yet.</p>
            : <div className="space-y-4">
                {serviceBreakdown.map(([service, { cents, count }], i) => (
                  <button key={service} type="button"
                    onClick={() => drill({ sessionType: service === "unlinked" ? "" : service })}
                    className="w-full text-left cursor-pointer">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700 truncate flex-1 capitalize">{service} <span className="text-[10px] text-slate-400">({count})</span></span>
                      <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: "#059669" }}>{fmtMoney(cents)}</span>
                    </div>
                    <AnimBar pct={(cents / maxService) * 100} color={["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#3D95CE"][i % 5]} delay={i * 80} />
                  </button>
                ))}
              </div>}
          </div>
        </div>
      </div>

      {/* ── Transactions ── */}
      <div ref={txRef} className="scroll-mt-6">
        <TransactionsPanel
          rows={periodRows}
          loading={loading}
          filters={filters}
          onFiltersChange={setFilters}
          periodLabel={periodLabel}
          onReload={load}
        />
      </div>

    </div>
  );
}
