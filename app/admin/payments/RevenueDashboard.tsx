"use client";
// Revenue command center orchestrator: loads the ledger + inquiries once,
// derives every section from one memoized pipeline, and owns the global
// filter state that all sections respond to.

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAdminInquiries, type AdminInquiry } from "@/lib/adminInquiries";
import { paymentMatchesPeriod } from "@/lib/paymentAnalytics";
import { normalizePaymentMethod, paymentsToCsv, type PaymentRow } from "@/lib/paymentFilters";
import { collectionRate, summarizePeriod, topShare, breakdownBy, safeDelta, clientKeyOf } from "@/lib/revenue/calc";
import { enrichPayments, type LedgerRow } from "@/lib/revenue/enrich";
import { deriveInsights, type Insight } from "@/lib/revenue/insights";
import { buildComparisonPeriod, buildPresetPeriod } from "@/lib/revenue/periods";
import { findQualityIssues } from "@/lib/revenue/quality";
import { buildReceivables, totalOutstandingCents } from "@/lib/revenue/receivables";
import { autoGranularity, bucketSeries, monthlyHeatmap, revenuePace } from "@/lib/revenue/series";
import { Reveal, RevStyles, useReducedMotion } from "./Glass";
import { REV } from "./palette";
import { DEFAULT_REVENUE_FILTERS, type RevenueFilters } from "./state";
import RevenueFilterBar from "./RevenueFilterBar";
import OverviewSection from "./OverviewSection";
import TrendSection from "./TrendSection";
import CompositionSection from "./CompositionSection";
import ClientsSection from "./ClientsSection";
import ReceivablesPanel from "./ReceivablesPanel";
import LedgerSection from "./LedgerSection";
import QualitySection from "./QualitySection";
import InsightsSection from "./InsightsSection";

function matchesDimensions(p: LedgerRow, f: RevenueFilters): boolean {
  if (f.service && p.serviceKey !== f.service) return false;
  if (f.school && p.schoolKey !== f.school) return false;
  if (f.method && normalizePaymentMethod(p.method) !== f.method) return false;
  if (f.status && p.status !== f.status) return false;
  if (f.search) {
    const haystack = [p.client_name, p.client_email, p.invoice, p.note].join(" ").toLowerCase();
    if (!haystack.includes(f.search.trim().toLowerCase())) return false;
  }
  return true;
}

export default function RevenueDashboard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [lastReconciledAt, setLastReconciledAt] = useState<string | null>(null);
  const [filters, setFilters] = useState<RevenueFilters>(DEFAULT_REVENUE_FILTERS);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [stagingReloadToken, setStagingReloadToken] = useState(0);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [paymentsRes, inquiriesData] = await Promise.all([
        fetch("/api/admin/payments").then(async res => {
          const json = await res.json() as { payments?: PaymentRow[]; lastReconciledAt?: string | null; error?: string };
          if (!res.ok) throw new Error(json.error ?? "Failed to load payments");
          return json;
        }),
        loadAdminInquiries().catch(err => {
          // Inquiries enrich the data but the ledger must still render without them.
          console.error("[RevenueDashboard] inquiries load failed:", err);
          return [] as AdminInquiry[];
        }),
      ]);
      setPayments(paymentsRes.payments ?? []);
      setLastReconciledAt(paymentsRes.lastReconciledAt ?? null);
      setInquiries(inquiriesData);
    } catch (err) {
      console.error("[RevenueDashboard] load failed:", err);
      setLoadError("Couldn't load the payments ledger. Check your connection and retry.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runClaudeAudit() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/sync-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json() as { total?: number; error?: string };
      if (!res.ok) { setSyncMessage(json.error ?? "Claude payment audit failed."); return; }
      setStagingReloadToken(t => t + 1);
      setSyncMessage(`Claude found ${json.total ?? 0} payment${json.total === 1 ? "" : "s"} awaiting review in Data Quality.`);
    } catch {
      setSyncMessage("Claude payment audit failed.");
    } finally {
      setSyncing(false);
    }
  }

  // ── Derivation pipeline ───────────────────────────────────────────────────
  // The controls bind to `filters` (instant), while every derived section uses
  // the deferred copy — so typing in search never blocks on recomputing and
  // re-rendering the whole dashboard per keystroke.
  const activeFilters = useDeferredValue(filters);

  const enriched = useMemo(() => enrichPayments(payments, inquiries), [payments, inquiries]);
  const rowsById = useMemo(() => new Map(enriched.map(r => [r.id, r])), [enriched]);

  const dimensionRows = useMemo(
    () => enriched.filter(p => matchesDimensions(p, activeFilters)),
    [enriched, activeFilters],
  );

  const period = useMemo(
    () => buildPresetPeriod(activeFilters.preset, new Date(), { start: activeFilters.customStart, end: activeFilters.customEnd }),
    [activeFilters.preset, activeFilters.customStart, activeFilters.customEnd],
  );
  const compPeriod = useMemo(() => buildComparisonPeriod(period, activeFilters.compare), [period, activeFilters.compare]);

  const periodRows = useMemo(
    () => dimensionRows.filter(p => paymentMatchesPeriod(p, period)),
    [dimensionRows, period],
  );
  const compRows = useMemo(
    () => (compPeriod ? dimensionRows.filter(p => paymentMatchesPeriod(p, compPeriod)) : null),
    [dimensionRows, compPeriod],
  );

  const summary = useMemo(() => summarizePeriod(periodRows), [periodRows]);
  const prevSummary = useMemo(() => (compRows ? summarizePeriod(compRows) : null), [compRows]);

  const receivables = useMemo(() => buildReceivables(dimensionRows, inquiries), [dimensionRows, inquiries]);
  const outstandingCents = totalOutstandingCents(receivables);

  const issues = useMemo(() => findQualityIssues(enriched), [enriched]);

  const sparkValues = useMemo(
    () => bucketSeries(periodRows, period, autoGranularity(period)).map(pt => pt.cents),
    [periodRows, period],
  );

  const pace = useMemo(
    () => revenuePace(periodRows, period, dimensionRows, compPeriod),
    [periodRows, period, dimensionRows, compPeriod],
  );

  const clientsBreakdown = useMemo(
    () => breakdownBy(periodRows, p => clientKeyOf(p)),
    [periodRows],
  );

  // Seasonal high: the period's collected total beats every full prior month.
  const isSeasonalHigh = useMemo(() => {
    if (summary.collectedCents <= 0 || !period.start) return false;
    const cells = monthlyHeatmap(enriched).filter(c =>
      c.year < period.start!.getFullYear()
      || (c.year === period.start!.getFullYear() && c.month < period.start!.getMonth()));
    return cells.length > 0 && cells.every(c => c.cents < summary.collectedCents);
  }, [enriched, summary.collectedCents, period]);

  const insights = useMemo(() => deriveInsights({
    summary,
    prevSummary,
    collectedDelta: safeDelta(summary.collectedCents, prevSummary ? prevSummary.collectedCents : null),
    services: breakdownBy(periodRows, p => p.serviceKey),
    schools: breakdownBy(periodRows, p => p.schoolKey),
    methods: breakdownBy(periodRows, p => normalizePaymentMethod(p.method)),
    clients: clientsBreakdown,
    receivables,
    issues,
    periodLabel: period.label,
    compareLabel: compPeriod?.label ?? null,
  }), [summary, prevSummary, periodRows, clientsBreakdown, receivables, issues, period.label, compPeriod]);

  // ── Interactions ──────────────────────────────────────────────────────────
  const patchFilters = useCallback((patch: Partial<RevenueFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [reduced]);

  function drillInsight(insight: Insight) {
    const d = insight.drill;
    if (d.kind === "service") { patchFilters({ service: d.value }); scrollTo("rev-composition"); }
    else if (d.kind === "school") { patchFilters({ school: d.value }); scrollTo("rev-composition"); }
    else if (d.kind === "method") { patchFilters({ method: d.value }); scrollTo("rev-ledger"); }
    else if (d.kind === "receivables") scrollTo("rev-receivables");
    else if (d.kind === "quality") scrollTo("rev-quality");
    else scrollTo("rev-ledger");
  }

  function exportCsv() {
    const blob = new Blob([paymentsToCsv(periodRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-${period.label.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="rev-canvas relative rounded-3xl p-3 md:p-5 overflow-hidden"
      style={{ background: REV.canvas, border: `1px solid ${REV.canvasBorder}` }}>
      <RevStyles />
      {/* ambient grid + glows */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: REV.grid, backgroundSize: "44px 44px" }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: REV.glowA }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: REV.glowB }} />

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: REV.accent }}>Revenue command center</p>
            <h2 className="text-xl md:text-2xl font-black leading-tight" style={{ color: REV.text }}>
              Know your money in seconds.
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/manual-payments" target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-black px-3 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: REV.neutralBg, color: REV.textSoft }}>
              Manual entry table ↗
            </Link>
            <button type="button" onClick={runClaudeAudit} disabled={syncing}
              className="text-[10px] font-black px-3 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${REV.violet}, ${REV.pink})`, color: "#fff" }}>
              {syncing ? "Claude checking…" : "✨ Claude audit payments"}
            </button>
          </div>
          {syncMessage && <p className="w-full text-[10px] font-bold" style={{ color: REV.textSoft }}>{syncMessage}</p>}
        </div>

        <RevenueFilterBar
          filters={filters}
          onChange={patchFilters}
          periodLabel={period.label}
          lastReconciledAt={lastReconciledAt}
          loading={loading}
          onRefresh={load}
          onExport={exportCsv}
          exportCount={periodRows.length}
        />

        {loadError && (
          <div className="px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-3"
            style={{ background: REV.redBg, color: REV.red, border: "1px solid rgba(248,113,113,0.3)" }}>
            {loadError}
            <button type="button" onClick={load} className="px-2.5 py-1 rounded-lg" style={{ background: "rgba(248,113,113,0.2)" }}>Retry</button>
          </div>
        )}

        <Reveal id="rev-overview" delay={0}>
          <OverviewSection
            loading={loading}
            summary={summary}
            prevSummary={prevSummary}
            sparkValues={sparkValues}
            outstandingCents={outstandingCents}
            outstandingCount={receivables.length}
            collectionRate={collectionRate(summary.collectedCents, outstandingCents)}
            top5ClientShare={topShare(clientsBreakdown, 5)}
            clientCount={new Set(enriched.filter(p => p.status === "active").map(clientKeyOf)).size}
            periodLabel={period.label}
            compareLabel={compPeriod?.label ?? null}
            isSeasonalHigh={isSeasonalHigh}
            onDrillLedger={() => scrollTo("rev-ledger")}
            onDrillReceivables={() => scrollTo("rev-receivables")}
          />
        </Reveal>

        <Reveal id="rev-insights" delay={60}>
          <InsightsSection loading={loading} insights={insights} onDrill={drillInsight} />
        </Reveal>

        <Reveal id="rev-trends" delay={120}>
          <TrendSection
            loading={loading}
            periodRows={periodRows}
            compRows={compRows}
            period={period}
            compPeriod={compPeriod}
            allRows={dimensionRows}
            pace={pace}
          />
        </Reveal>

        <Reveal id="rev-composition" delay={180}>
          <CompositionSection
            loading={loading}
            periodRows={periodRows}
            compRows={compRows}
            compareLabel={compPeriod?.label ?? null}
            collectedCents={summary.collectedCents}
            onDrill={patchFilters}
          />
        </Reveal>

        <Reveal id="rev-clients" delay={240}>
          <ClientsSection
            loading={loading}
            periodRows={periodRows}
            inquiries={inquiries}
            receivables={receivables}
            periodLabel={period.label}
          />
        </Reveal>

        <Reveal id="rev-receivables" delay={300}>
          <ReceivablesPanel loading={loading} receivables={receivables} />
        </Reveal>

        <Reveal id="rev-quality" delay={360}>
          <QualitySection
            loading={loading}
            issues={issues}
            rowsById={rowsById}
            allRows={enriched}
            stagingReloadToken={stagingReloadToken}
            onLedgerChanged={load}
          />
        </Reveal>

        <Reveal id="rev-ledger" delay={420}>
          <LedgerSection
            loading={loading}
            rows={periodRows}
            periodLabel={period.label}
            issues={issues}
            onReload={load}
          />
        </Reveal>
      </div>
    </div>
  );
}
