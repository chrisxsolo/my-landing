"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { C } from "@/lib/colors";
import {
  buildMonthPeriod,
  buildRelativePeriod,
  filterPaymentsByPeriod,
  filterRevenuePayments,
  isConfirmedRevenuePayment,
  paymentMatchesPeriod,
  type RevenuePeriod,
} from "@/lib/paymentAnalytics";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

type Payment = {
  id: number;
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount: string;
  amount_cents: number;
  method: string;
  payment_type: string;
  invoice: string;
  note: string;
  source: string;
  status: string; // active | voided | refunded
  paid_at: string;
  session_date: string | null;
  // joined from inquiries
  inquiry_session_type?: string | null;
};

type MethodFilter = "all" | "Venmo" | "Zelle" | "PayPal" | "Cash App" | "Pixieset" | "other";

const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  Venmo:   { label: "Venmo",   color: "#3D95CE", bg: "rgba(61,149,206,0.1)"  },
  Zelle:   { label: "Zelle",   color: "#6D1ED4", bg: "rgba(109,30,212,0.1)"  },
  PayPal:  { label: "PayPal",  color: "#0070BA", bg: "rgba(0,112,186,0.1)"   },
  "Cash App": { label: "Cash App", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  Pixieset:{ label: "Pixieset",color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  other:   { label: "Other",   color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

function normMethod(m: string): string {
  if (!m) return "other";
  const lower = m.toLowerCase();
  if (lower === "venmo") return "Venmo";
  if (lower === "zelle") return "Zelle";
  if (lower === "paypal") return "PayPal";
  if (lower === "cash app" || lower === "cash") return "Cash App";
  if (lower === "pixieset") return "Pixieset";
  return "other";
}

function parseCents(amount: string): number {
  if (!amount) return 0;
  const m = amount.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!m) return 0;
  return Math.round(parseFloat(m[0].replace(",", "")) * 100);
}

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function MoneyUp({ target, className, color }: { target: number; className?: string; color?: string }) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const t0 = performance.now();
    const dur = 900;
    function tick(now: number) {
      const t = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = target;
    }
    requestAnimationFrame(tick);
  }, [target]);
  return <span className={className} style={color ? { color } : undefined}>{fmtMoney(val)}</span>;
}

function AnimBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 80);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full"
        style={{ width: `${width}%`, background: color, transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)" }} />
    </div>
  );
}

function BarCol({ pct, isCurrent, isHov, delay }: { pct: number; isCurrent: boolean; isHov: boolean; delay: number }) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setHeight(pct), delay + 100);
    return () => clearTimeout(t);
  }, [pct, delay]);
  const base = isCurrent
    ? "linear-gradient(180deg,#10b981,#6ee7b7)"
    : "linear-gradient(180deg,rgba(16,185,129,0.35),rgba(16,185,129,0.15))";
  return (
    <div className="w-full flex items-end justify-center" style={{ height: 130 }}>
      <div className="w-full rounded-t-lg" style={{
        height: `${height}%`, minHeight: height > 0 ? 4 : 0,
        background: isHov ? "linear-gradient(180deg,#10b981,#34d399)" : base,
        transition: `height 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms, background 0.2s`,
        transform: isHov ? "scaleX(1.08)" : "scaleX(1)",
      }} />
    </div>
  );
}

// Confirm popover for void/refund
function ActionMenu({
  payment,
  onDone,
}: {
  payment: Payment;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"idle" | "confirm-void" | "confirm-refund">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(action: "void" | "refund") {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/void-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, action }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok) { setErr(json.error ?? "Failed"); setBusy(false); return; }
      onDone();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  if (step === "confirm-void") return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500">Remove this payment?</span>
      <button onClick={() => submit("void")} disabled={busy}
        className="text-xs font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
        {busy ? "…" : "Yes, remove"}
      </button>
      <button onClick={() => setStep("idle")} disabled={busy}
        className="text-xs text-slate-400 hover:text-slate-600">cancel</button>
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  );

  if (step === "confirm-refund") return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500">Mark as refunded?</span>
      <button onClick={() => submit("refund")} disabled={busy}
        className="text-xs font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
        style={{ background: "rgba(245,158,11,0.1)", color: "#d97706" }}>
        {busy ? "…" : "Yes, refunded"}
      </button>
      <button onClick={() => setStep("idle")} disabled={busy}
        className="text-xs text-slate-400 hover:text-slate-600">cancel</button>
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  );

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setStep("confirm-void")}
        title="Remove — recorded in error, disappears from analytics"
        className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
        ✕ void
      </button>
      <button onClick={() => setStep("confirm-refund")}
        title="Refund — money was returned to client, shows as negative"
        className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
        style={{ background: "rgba(245,158,11,0.08)", color: "#d97706" }}>
        ↩ refund
      </button>
    </div>
  );
}

export default function PaymentAnalyticsTab() {
  const [loading, setLoading]   = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [period, setPeriod]     = useState<RevenuePeriod>("thisYear");
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [method, setMethod]     = useState<MethodFilter>("all");
  const [hoverBar, setHoverBar] = useState<number | null>(null);
  const [showVoided, setShowVoided] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments");
      const json = await res.json() as { payments?: Payment[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load payments");
      setPayments(json.payments ?? []);
    } catch (err) {
      console.error("[PaymentAnalyticsTab] load payments failed:", err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialPayments() {
      setLoading(true);
      let nextPayments: Payment[] = [];
      try {
        const res = await fetch("/api/admin/payments");
        const json = await res.json() as { payments?: Payment[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load payments");
        nextPayments = json.payments ?? [];
      } catch (err) {
        console.error("[PaymentAnalyticsTab] initial payments load failed:", err);
      }
      if (cancelled) return;
      setPayments(nextPayments);
      setLoading(false);
    }
    loadInitialPayments();
    return () => { cancelled = true; };
  }, []);

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
      await load();
      setSyncMessage(`Claude checked Gmail and found ${json.total ?? 0} payment${json.total === 1 ? "" : "s"}.`);
    } catch {
      setSyncMessage("Claude payment audit failed.");
    } finally {
      setSyncing(false);
    }
  }

  // Only confirmed active payments count toward revenue; synthetic assumptions stay out of totals
  const activePayments = filterRevenuePayments(payments);

  const inPeriod = filterPaymentsByPeriod(activePayments, activePeriod);

  const filtered = method === "all"
    ? inPeriod
    : inPeriod.filter(p => normMethod(p.method) === method);

  // Totals — use amount_cents when available, fall back to parsing amount string
  const totalCents    = filtered.reduce((s, p) => s + (p.amount_cents || parseCents(p.amount)), 0);
  const sessionCount  = filtered.length;
  const avgCents      = sessionCount > 0 ? Math.round(totalCents / sessionCount) : 0;

  // Method breakdown
  const allMethods = [...new Set(inPeriod.map(p => normMethod(p.method)))];
  const methodBreakdown = allMethods.map(m => {
    const items = inPeriod.filter(p => normMethod(p.method) === m);
    const cents  = items.reduce((s, p) => s + (p.amount_cents || parseCents(p.amount)), 0);
    return { method: m, count: items.length, cents, pct: totalCents > 0 ? (cents / totalCents) * 100 : 0 };
  }).filter(m => m.count > 0).sort((a, b) => b.cents - a.cents);

  // Monthly chart (last 12 months, active only)
  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d      = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const items  = filterPaymentsByPeriod(activePayments, buildMonthPeriod(d.getFullYear(), d.getMonth()));
    const cents = items.reduce((s, p) => s + (p.amount_cents || parseCents(p.amount)), 0);
    return {
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(), month: d.getMonth(), cents, count: items.length,
      isCurrentMonth: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
    };
  });
  const maxMonthCents = Math.max(...monthlyData.map(m => m.cents), 1);

  // Payment type breakdown (deposit_1, deposit_2, full, other)
  const typeMap: Record<string, number> = {};
  filtered.forEach(p => {
    const t = p.payment_type ?? "other";
    typeMap[t] = (typeMap[t] ?? 0) + (p.amount_cents || parseCents(p.amount));
  });
  const typeBreakdown = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const maxType = typeBreakdown[0]?.[1] ?? 1;

  // All rows to display in transaction list (active + optionally voided/refunded)
  const listRows = payments.filter(p => {
    if (p.status !== "active" && !showVoided) return false;
    if (p.status === "active" && !isConfirmedRevenuePayment(p)) return false;
    if (!paymentMatchesPeriod(p, activePeriod)) return false;
    if (method !== "all" && normMethod(p.method) !== method) return false;
    return true;
  });

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#34d399,#6ee7b7)" }} />
        <div className="p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: "#10b981" }}>Payment Analytics</p>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Revenue from your sessions.</h2>
            <p className="mt-1 text-sm text-slate-400 font-medium">Synced from Gmail · Venmo, Zelle, PayPal tracked automatically.</p>
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

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue",    node: <MoneyUp target={totalCents}   className="text-3xl font-black" color="#10b981" />, sub: periodLabel },
          { label: "Payments Recorded",node: <span className="text-3xl font-black" style={{ color: C.p1 }}>{sessionCount}</span>, sub: method === "all" ? "all methods" : method },
          { label: "Avg per Payment",  node: <MoneyUp target={avgCents}     className="text-3xl font-black" color="#d97706" />, sub: sessionCount > 0 ? `across ${sessionCount} payment${sessionCount === 1 ? "" : "s"}` : "no data" },
        ].map(({ label, node, sub }) => (
          <div key={label} className={card}>
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#34d399)" }} />
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
              <div className="mb-1">{node}</div>
              <p className="text-[10px] text-slate-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Monthly revenue chart ── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#6ee7b7)" }} />
        <div className="p-6">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#10b981" }}>Monthly Revenue</p>
              <p className="text-sm text-slate-400 font-medium">Last 12 months</p>
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
                  onClick={() => setSelectedMonth({ year: m.year, month: m.month })}
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

      {/* ── Method breakdown + Payment type ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#a78bfa)" }} />
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#6366f1" }}>By Payment Method</p>
              <div className="flex gap-1 flex-wrap">
                {(["all", ...allMethods] as (MethodFilter | string)[]).map(m => {
                  const meta = m === "all" ? null : METHOD_META[m as string] ?? METHOD_META.other;
                  return (
                    <button key={m} onClick={() => setMethod(m as MethodFilter)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all capitalize"
                      style={method === m
                        ? { background: meta ? meta.bg : "rgba(16,185,129,0.1)", color: meta ? meta.color : "#10b981" }
                        : { background: "rgba(148,163,184,0.08)", color: "#94a3b8" }}>
                      {m === "all" ? "All" : (METHOD_META[m as string]?.label ?? m)}
                    </button>
                  );
                })}
              </div>
            </div>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : methodBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No payments yet.</p>
            ) : (
              <div className="space-y-4">
                {methodBreakdown.map((m, i) => {
                  const meta = METHOD_META[m.method] ?? METHOD_META.other;
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                          <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{m.count}</span>
                        </div>
                        <span className="text-sm font-black" style={{ color: meta.color }}>{fmtMoney(m.cents)}</span>
                      </div>
                      <AnimBar pct={m.pct} color={meta.color} delay={i * 80} />
                      <p className="text-[10px] text-slate-400 mt-1">{m.pct.toFixed(1)}% of revenue</p>
                    </div>
                  );
                })}
                {methodBreakdown.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex rounded-full overflow-hidden h-4">
                      {methodBreakdown.map(m => (
                        <div key={m.method} className="h-full transition-all duration-700"
                          style={{ width: `${m.pct}%`, background: (METHOD_META[m.method] ?? METHOD_META.other).color }}
                          title={`${(METHOD_META[m.method] ?? METHOD_META.other).label}: ${fmtMoney(m.cents)}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad12 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p1 }}>By Payment Type</p>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : typeBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {typeBreakdown.map(([type, cents], i) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700 truncate flex-1 capitalize">{type.replace("_", " ")}</span>
                      <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: C.p1 }}>{fmtMoney(cents)}</span>
                    </div>
                    <AnimBar pct={(cents / maxType) * 100} color={[C.p1, C.p2, C.p3, "#f59e0b", "#10b981"][i % 5]} delay={i * 80} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction list ── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#059669)" }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#10b981" }}>Transactions</p>
              <p className="text-sm text-slate-400 font-medium">{listRows.filter(r => r.status === "active").length} active · {periodLabel}</p>
            </div>
            <button onClick={() => setShowVoided(v => !v)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
              style={showVoided
                ? { background: "rgba(239,68,68,0.08)", color: "#ef4444" }
                : { background: "rgba(148,163,184,0.08)", color: "#94a3b8" }}>
              {showVoided ? "Hide voided/refunded" : "Show voided/refunded"}
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : listRows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-2xl mb-2">💳</p>
              <p className="text-sm text-slate-400">No payments found for this period.</p>
              <p className="text-xs text-slate-300 mt-1">Try All Time or sync payments from the Clients tab.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listRows.map((p, i) => {
                const mKey  = normMethod(p.method);
                const meta  = METHOD_META[mKey] ?? METHOD_META.other;
                const cents = p.amount_cents || parseCents(p.amount);
                const ts    = p.paid_at ?? p.session_date;
                const dateStr = ts
                  ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Unknown date";
                const isVoided   = p.status === "voided";
                const isRefunded = p.status === "refunded";
                const isOrphan   = !p.inquiry_id;

                return (
                  <div key={p.id}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all hover:shadow-sm"
                    style={{
                      background: isVoided ? "rgba(239,68,68,0.03)" : isRefunded ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? "rgba(248,250,252,0.8)" : "white",
                      border: isVoided ? "1px solid rgba(239,68,68,0.12)" : isRefunded ? "1px solid rgba(245,158,11,0.15)" : "1px solid rgba(148,163,184,0.08)",
                      opacity: isVoided ? 0.6 : 1,
                    }}>
                    {/* Method icon */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.label.slice(0, 1)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.inquiry_id ? (
                          <Link href={`/admin/conversation/${p.inquiry_id}`}
                            className={`text-sm font-black text-slate-900 hover:underline ${isVoided ? "line-through" : ""}`}
                            title="Open client card and email thread">
                            {p.client_name}
                          </Link>
                        ) : (
                          <Link href={`/admin?tab=clients&client=${encodeURIComponent(p.client_email || p.client_name)}`}
                            className={`text-sm font-black text-slate-900 hover:underline ${isVoided ? "line-through" : ""}`}
                            title="Find this client in Clients">
                            {p.client_name}
                          </Link>
                        )}
                        {isOrphan && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                            no inquiry
                          </span>
                        )}
                        {isVoided && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            voided
                          </span>
                        )}
                        {isRefunded && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(245,158,11,0.1)", color: "#d97706" }}>
                            refunded
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                          style={{ background: "rgba(148,163,184,0.1)", color: "#64748b" }}>
                          {p.payment_type?.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {p.client_email && <span className="text-[10px] text-slate-400">{p.client_email}</span>}
                        <span className="text-[10px] text-slate-400">{dateStr}</span>
                        {p.source === "auto" && <span className="text-[10px] text-blue-400">auto</span>}
                      </div>
                      {/* Void/refund actions — only for active payments */}
                      {p.status === "active" && (
                        <div className="mt-1.5">
                          <ActionMenu payment={p} onDone={load} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-base font-black"
                        style={{ color: isVoided ? "#94a3b8" : isRefunded ? "#d97706" : cents > 0 ? "#10b981" : "#94a3b8" }}>
                        {isRefunded ? `(${fmtMoney(cents)})` : cents > 0 ? fmtMoney(cents) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
