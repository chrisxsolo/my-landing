"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

type Inquiry = {
  id: number;
  name: string;
  email: string;
  session_type: string | null;
  session_date: string | null;
  payment_status: string | null;
  payment_note: string | null;
  payment_detected_at: string | null;
};

type Period = "all" | "thisMonth" | "lastMonth" | "thisYear";
type MethodFilter = "all" | "venmo" | "zelle" | "paypal" | "cash" | "other";

const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  venmo:  { label: "Venmo",  color: "#3D95CE", bg: "rgba(61,149,206,0.1)" },
  zelle:  { label: "Zelle",  color: "#6D1ED4", bg: "rgba(109,30,212,0.1)" },
  paypal: { label: "PayPal", color: "#0070BA", bg: "rgba(0,112,186,0.1)"  },
  cash:   { label: "Cash",   color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  other:  { label: "Other",  color: "#94a3b8", bg: "rgba(148,163,184,0.1)"},
};

function detectMethod(note: string | null): string {
  if (!note) return "other";
  const n = note.toLowerCase();
  if (n.includes("venmo"))  return "venmo";
  if (n.includes("zelle"))  return "zelle";
  if (n.includes("paypal")) return "paypal";
  if (n.includes("cash"))   return "cash";
  return "other";
}

function parseAmount(note: string | null): number {
  if (!note) return 0;
  const m = note.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(",", ""));
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function periodBounds(p: Period): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  if (p === "all") return { start: null, end: null, label: "All Time" };
  if (p === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end, label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  if (p === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start, end, label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  // thisYear
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  return { start, end, label: `${now.getFullYear()}` };
}

// Animated dollar counter
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
  return (
    <span className={className} style={color ? { color } : undefined}>
      {fmtMoney(val)}
    </span>
  );
}

// Animated bar that grows in on mount/change
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

export default function PaymentAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Inquiry[]>([]);
  const [period, setPeriod] = useState<Period>("thisYear");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [hoverBar, setHoverBar] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inquiries")
      .select("id,name,email,session_type,session_date,payment_status,payment_note,payment_detected_at")
      .eq("payment_status", "paid")
      .order("payment_detected_at", { ascending: false });
    setPayments((data ?? []) as Inquiry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { start, end, label: periodLabel } = periodBounds(period);

  // Filter by period
  const inPeriod = payments.filter(p => {
    const ts = p.payment_detected_at ?? p.session_date;
    if (!ts) return period === "all";
    const d = new Date(ts);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  // Filter by method
  const filtered = method === "all"
    ? inPeriod
    : inPeriod.filter(p => detectMethod(p.payment_note) === method);

  // Totals
  const totalRevenue = filtered.reduce((sum, p) => sum + parseAmount(p.payment_note), 0);
  const sessionCount = filtered.length;
  const avgSession = sessionCount > 0 ? totalRevenue / sessionCount : 0;

  // Method breakdown
  const methodBreakdown = (["venmo", "zelle", "paypal", "cash", "other"] as const).map(m => {
    const items = inPeriod.filter(p => detectMethod(p.payment_note) === m);
    const total = items.reduce((sum, p) => sum + parseAmount(p.payment_note), 0);
    return { method: m, count: items.length, total, pct: totalRevenue > 0 ? (total / inPeriod.reduce((s,p)=>s+parseAmount(p.payment_note),0)) * 100 : 0 };
  }).filter(m => m.count > 0).sort((a, b) => b.total - a.total);

  // Monthly breakdown for chart (last 12 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthPayments = payments.filter(p => {
      const ts = p.payment_detected_at ?? p.session_date;
      if (!ts) return false;
      const pd = new Date(ts);
      return pd >= d && pd <= monthEnd;
    });
    const total = monthPayments.reduce((sum, p) => sum + parseAmount(p.payment_note), 0);
    return {
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
      total,
      count: monthPayments.length,
      isCurrentMonth: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
    };
  });
  const maxMonthTotal = Math.max(...monthlyData.map(m => m.total), 1);

  // Session type breakdown
  const typeMap: Record<string, number> = {};
  filtered.forEach(p => {
    const t = p.session_type ?? "Other";
    typeMap[t] = (typeMap[t] ?? 0) + parseAmount(p.payment_note);
  });
  const typeBreakdown = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxType = typeBreakdown[0]?.[1] ?? 1;

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
            {/* Period pills */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-50 border border-slate-100">
              {([
                { v: "thisMonth" as Period, l: "This Mo." },
                { v: "lastMonth" as Period, l: "Last Mo." },
                { v: "thisYear"  as Period, l: "This Year" },
                { v: "all"       as Period, l: "All Time" },
              ]).map(({ v, l }) => (
                <button key={v} onClick={() => setPeriod(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                  style={period === v ? { background: "rgba(16,185,129,0.12)", color: "#10b981" } : { color: "#94a3b8" }}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading}
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue", node: <MoneyUp target={totalRevenue} className="text-3xl font-black" color="#10b981" />, sub: periodLabel },
          { label: "Sessions Paid", node: <span className="text-3xl font-black" style={{ color: C.p1 }}>{sessionCount}</span>, sub: method === "all" ? "all methods" : METHOD_META[method]?.label },
          { label: "Avg per Session", node: <MoneyUp target={avgSession} className="text-3xl font-black" color="#d97706" />, sub: sessionCount > 0 ? `across ${sessionCount} session${sessionCount === 1 ? "" : "s"}` : "no data" },
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
              {fmtMoney(monthlyData.reduce((s, m) => s + m.total, 0))} total · {monthlyData.reduce((s, m) => s + m.count, 0)} sessions
            </p>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
          ) : (
            <>
              {/* Bars + floating tooltip */}
              <div className="relative flex items-end justify-between gap-1.5 px-1" style={{ height: 160 }}>
                {/* Tooltip — floats above bars, never overlaps */}
                {hoverBar !== null && monthlyData[hoverBar] && (() => {
                  const m = monthlyData[hoverBar];
                  const centerPct = (hoverBar + 0.5) / 12 * 100;
                  return (
                    <div className="absolute pointer-events-none z-20"
                      style={{
                        left: `${centerPct}%`,
                        bottom: "100%",
                        marginBottom: 10,
                        transform: centerPct > 75 ? "translateX(-90%)" : centerPct < 15 ? "translateX(-5%)" : "translateX(-50%)",
                      }}>
                      <div className="rounded-xl px-3 py-2 shadow-xl whitespace-nowrap"
                        style={{ background: "rgba(15,15,25,0.92)" }}>
                        <p className="text-xs font-bold text-white">{m.label} {m.year}</p>
                        <p className="text-sm font-black" style={{ color: "#34d399" }}>{fmtMoney(m.total)}</p>
                        <p className="text-[10px] text-white/60">{m.count} session{m.count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="w-2 h-2 rotate-45 mt-[-4px] mx-auto" style={{ background: "rgba(15,15,25,0.92)" }} />
                    </div>
                  );
                })()}

                {monthlyData.map((m, i) => {
                  const pct = (m.total / maxMonthTotal) * 100;
                  const isHov = hoverBar === i;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                      onMouseEnter={() => setHoverBar(i)} onMouseLeave={() => setHoverBar(null)}>
                      <BarCol pct={pct} isCurrent={m.isCurrentMonth} isHov={isHov} delay={i * 40} />
                      <p className="text-[9px] font-black transition-colors"
                        style={{ color: isHov ? "#10b981" : m.isCurrentMonth ? "#10b981" : "#94a3b8" }}>
                        {m.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Method breakdown + Session types ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Payment method breakdown */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#a78bfa)" }} />
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#6366f1" }}>By Payment Method</p>
              <div className="flex gap-1">
                {(["all", "venmo", "zelle", "paypal", "cash", "other"] as MethodFilter[]).map(m => {
                  const meta = m === "all" ? null : METHOD_META[m];
                  if (m !== "all" && !methodBreakdown.find(b => b.method === m)) return null;
                  return (
                    <button key={m} onClick={() => setMethod(m)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all capitalize"
                      style={method === m
                        ? { background: meta ? meta.bg : "rgba(16,185,129,0.1)", color: meta ? meta.color : "#10b981" }
                        : { background: "rgba(148,163,184,0.08)", color: "#94a3b8" }}>
                      {m === "all" ? "All" : meta?.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : methodBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No paid sessions yet.</p>
            ) : (
              <div className="space-y-4">
                {methodBreakdown.map((m, i) => {
                  const meta = METHOD_META[m.method];
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                          <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: meta.bg, color: meta.color }}>
                            {m.count}
                          </span>
                        </div>
                        <span className="text-sm font-black" style={{ color: meta.color }}>{fmtMoney(m.total)}</span>
                      </div>
                      <AnimBar pct={m.pct} color={meta.color} delay={i * 80} />
                      <p className="text-[10px] text-slate-400 mt-1">{m.pct.toFixed(1)}% of revenue</p>
                    </div>
                  );
                })}

                {/* Donut visual */}
                {methodBreakdown.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex rounded-full overflow-hidden h-4">
                      {methodBreakdown.map((m) => (
                        <div key={m.method} className="h-full transition-all duration-700"
                          style={{ width: `${m.pct}%`, background: METHOD_META[m.method].color }}
                          title={`${METHOD_META[m.method].label}: ${fmtMoney(m.total)}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Session type revenue */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad12 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p1 }}>Revenue by Session Type</p>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : typeBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {typeBreakdown.map(([type, total], i) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700 truncate flex-1">{type}</span>
                      <span className="text-sm font-black ml-2 flex-shrink-0" style={{ color: C.p1 }}>{fmtMoney(total)}</span>
                    </div>
                    <AnimBar pct={(total / maxType) * 100} color={[C.p1, C.p2, C.p3, "#f59e0b", "#10b981"][i % 5]} delay={i * 80} />
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
              <p className="text-sm text-slate-400 font-medium">{filtered.length} session{filtered.length !== 1 ? "s" : ""} · {periodLabel}</p>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-2xl mb-2">💳</p>
              <p className="text-sm text-slate-400">No paid sessions found for this period.</p>
              <p className="text-xs text-slate-300 mt-1">Try "All Time" or sync payments from the Clients tab.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p, i) => {
                const m = detectMethod(p.payment_note);
                const meta = METHOD_META[m];
                const amount = parseAmount(p.payment_note);
                const ts = p.payment_detected_at ?? p.session_date;
                const dateStr = ts
                  ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Unknown date";
                return (
                  <div key={p.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:shadow-sm"
                    style={{ background: i % 2 === 0 ? "rgba(248,250,252,0.8)" : "white", border: "1px solid rgba(148,163,184,0.08)" }}>
                    {/* Method dot */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.label.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.session_type && <span className="text-[10px] font-semibold text-slate-500">{p.session_type}</span>}
                        <span className="text-[10px] text-slate-400">{dateStr}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-base font-black" style={{ color: amount > 0 ? "#10b981" : "#94a3b8" }}>
                        {amount > 0 ? fmtMoney(amount) : "—"}
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

// Animated growing bar for monthly chart
function BarCol({ pct, isCurrent, isHov, delay }: { pct: number; isCurrent: boolean; isHov: boolean; delay: number }) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setHeight(pct), delay + 100);
    return () => clearTimeout(t);
  }, [pct, delay]);

  const base = isCurrent
    ? "linear-gradient(180deg,#10b981,#6ee7b7)"
    : "linear-gradient(180deg,rgba(16,185,129,0.35),rgba(16,185,129,0.15))";
  const hov = "linear-gradient(180deg,#10b981,#34d399)";

  return (
    <div className="w-full flex items-end justify-center" style={{ height: 130 }}>
      <div className="w-full rounded-t-lg"
        style={{
          height: `${height}%`,
          minHeight: height > 0 ? 4 : 0,
          background: isHov ? hov : base,
          transition: `height 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms, background 0.2s`,
          transform: isHov ? "scaleX(1.08)" : "scaleX(1)",
        }} />
    </div>
  );
}
