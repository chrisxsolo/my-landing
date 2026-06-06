"use client";
import { useState, useEffect, useCallback } from "react";
import { C } from "@/lib/colors";
import { loadAdminInquiries, type AdminInquiry } from "@/lib/adminInquiries";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

type Inquiry = AdminInquiry;

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function parseAmount(note: string | null): number {
  if (!note) return 0;
  const m = note.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1].replace(",", "")) : 0;
}

const SCHOOL_PATTERNS: { key: string; label: string; emoji: string; patterns: RegExp[] }[] = [
  { key: "sjsu",      label: "SJSU",           emoji: "🔵", patterns: [/san jose state|sjsu/i] },
  { key: "berkeley",  label: "UC Berkeley",    emoji: "🐻", patterns: [/berkeley|uc berkeley|cal\b/i] },
  { key: "sfsu",      label: "SF State",       emoji: "🌁", patterns: [/sf state|sfsu|san francisco state/i] },
  { key: "stanford",  label: "Stanford",       emoji: "🌲", patterns: [/stanford/i] },
  { key: "scu",       label: "Santa Clara",    emoji: "⛪", patterns: [/santa clara|scu\b/i] },
  { key: "usf",       label: "USF",            emoji: "🦅", patterns: [/university of san francisco|usf\b/i] },
  { key: "ucd",       label: "UC Davis",       emoji: "🐄", patterns: [/uc davis|davis/i] },
  { key: "ucsc",      label: "UC Santa Cruz",  emoji: "🍌", patterns: [/santa cruz|ucsc/i] },
  { key: "sjcc",      label: "SJCC/De Anza",   emoji: "🏫", patterns: [/de anza|sjcc|community college/i] },
];

function detectSchool(inq: Inquiry): string {
  const haystack = `${inq.session_type ?? ""} ${inq.message} ${inq.email}`.toLowerCase();
  for (const s of SCHOOL_PATTERNS) {
    if (s.patterns.some(p => p.test(haystack))) return s.key;
  }
  return "other";
}

const SOURCE_PATTERNS: { key: string; label: string; emoji: string; color: string; patterns: RegExp[] }[] = [
  { key: "instagram", label: "Instagram",  emoji: "📸", color: "#e1306c", patterns: [/instagram|@|ig\b|insta\b|your (post|reel|story|page)/i] },
  { key: "google",    label: "Google",     emoji: "🔍", color: "#4285f4", patterns: [/google|searched/i] },
  { key: "referral",  label: "Referral",   emoji: "🤝", color: "#10b981", patterns: [/referr|recommend|friend|told me|my (sister|brother|mom|dad|cousin|roommate|classmate)|word of mouth/i] },
  { key: "tiktok",    label: "TikTok",     emoji: "🎵", color: "#00b8a9", patterns: [/tiktok/i] },
  { key: "linktree",  label: "Linktree",   emoji: "🌿", color: "#43e660", patterns: [/linktree|link in bio/i] },
];

function detectSource(inq: Inquiry): string {
  const haystack = `${inq.message}`.toLowerCase();
  for (const s of SOURCE_PATTERNS) {
    if (s.patterns.some(p => p.test(haystack))) return s.key;
  }
  return "unknown";
}

function avgMinutes(items: number[]): number {
  if (!items.length) return 0;
  return items.reduce((a, b) => a + b, 0) / items.length;
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Simple animated number
function CountUp({ target, decimals = 0, suffix = "" }: { target: number; decimals?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const dur = 700;
    function tick(now: number) {
      const t = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(target * ease);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target]);
  return <>{val.toFixed(decimals)}{suffix}</>;
}

function Bar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), delay + 60); return () => clearTimeout(t); }, [pct, delay]);
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, transition: "width 0.65s cubic-bezier(0.22,1,0.36,1)" }} />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InquiryAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInquiries(await loadAdminInquiries());
    } catch (error) {
      console.error("[InquiryAnalyticsTab] load failed:", error);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Skip obvious spam ────────────────────────────────────────────────────
  const real = inquiries.filter(i => !i.name.match(/^[A-Z]{10,}$/) && i.email.includes("@"));

  // ── Core funnel numbers ──────────────────────────────────────────────────
  const total = real.length;
  const replied = real.filter(i => i.reply_sent_at || ["responded", "archived", "manual"].includes(i.status)).length;
  const paid = real.filter(i => i.payment_status === "paid").length;
  const unpaid = real.filter(i => i.payment_status !== "paid");
  const conversionRate = total > 0 ? (paid / total) * 100 : 0;
  const replyRate = total > 0 ? (replied / total) * 100 : 0;

  // ── Avg response time ────────────────────────────────────────────────────
  const responseTimes = real
    .filter(i => i.reply_sent_at)
    .map(i => (new Date(i.reply_sent_at!).getTime() - new Date(i.created_at).getTime()) / 60000)
    .filter(m => m > 0 && m < 60 * 24 * 14); // ignore clearly wrong values
  const avgResponseMin = avgMinutes(responseTimes);

  // ── Unpaid $ at stake ────────────────────────────────────────────────────
  // Estimate: avg paid amount * unpaid count with a reply (warm leads)
  const warmUnpaid = unpaid.filter(i => i.reply_sent_at || i.status === "responded");
  const paidAmounts = real.filter(i => i.payment_status === "paid").map(i => parseAmount(i.payment_note));
  const avgPaid = paidAmounts.length ? paidAmounts.reduce((a, b) => a + b, 0) / paidAmounts.length : 350;
  const unpaidRevenueAtStake = warmUnpaid.length * avgPaid;

  // ── By school ────────────────────────────────────────────────────────────
  const schoolMap: Record<string, { count: number; paid: number }> = {};
  real.forEach(i => {
    const k = detectSchool(i);
    if (!schoolMap[k]) schoolMap[k] = { count: 0, paid: 0 };
    schoolMap[k].count++;
    if (i.payment_status === "paid") schoolMap[k].paid++;
  });
  const schoolData = SCHOOL_PATTERNS
    .map(s => ({ ...s, ...(schoolMap[s.key] ?? { count: 0, paid: 0 }) }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const otherSchool = schoolMap["other"] ?? { count: 0, paid: 0 };
  const maxSchool = Math.max(...schoolData.map(s => s.count), otherSchool.count, 1);

  // ── By lead source ───────────────────────────────────────────────────────
  const sourceMap: Record<string, { count: number; paid: number }> = {};
  real.forEach(i => {
    const k = detectSource(i);
    if (!sourceMap[k]) sourceMap[k] = { count: 0, paid: 0 };
    sourceMap[k].count++;
    if (i.payment_status === "paid") sourceMap[k].paid++;
  });
  const knownSources = SOURCE_PATTERNS
    .map(s => ({ ...s, ...(sourceMap[s.key] ?? { count: 0, paid: 0 }) }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const unknownSource = sourceMap["unknown"] ?? { count: 0, paid: 0 };
  const maxSource = Math.max(...knownSources.map(s => s.count), unknownSource.count, 1);

  // ── Session type count breakdown (all inquiries) ─────────────────────────
  const typeMap: Record<string, { count: number; paid: number }> = {};
  real.forEach(i => {
    const t = (i.session_type ?? "Other").trim() || "Other";
    if (!typeMap[t]) typeMap[t] = { count: 0, paid: 0 };
    typeMap[t].count++;
    if (i.payment_status === "paid") typeMap[t].paid++;
  });
  const typeData = Object.entries(typeMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);
  const maxTypeCount = typeData[0]?.[1].count ?? 1;

  // ── Warm unpaid leads list ───────────────────────────────────────────────
  const warmUnpaidList = warmUnpaid.slice(0, 8);

  const FUNNEL_COLORS = [C.p1, C.p2, C.p3, "#f59e0b", "#10b981", "#6366f1"];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad321 }} />
        <div className="p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: C.p1 }}>Funnel Analytics</p>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Where your clients come from — and where they drop.</h2>
            <p className="mt-1.5 text-sm font-medium text-slate-400">Based on {total} real inquiries.</p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-50 self-start"
            style={{ background: C.p1_10, color: C.p1 }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Funnel stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Inquiries",    val: total,              suffix: "",   color: C.p1,      grad: C.grad12,  sub: "all time" },
          { label: "Reply Rate",         val: replyRate,          suffix: "%",  color: C.p2,      grad: C.grad23,  sub: `${replied} replied` },
          { label: "Booking Conversion", val: conversionRate,     suffix: "%",  color: "#10b981", grad: "linear-gradient(90deg,#10b981,#34d399)", sub: `${paid} paid` },
          { label: "Avg Response Time",  val: 0, suffix: "",      color: "#f59e0b", grad: "linear-gradient(90deg,#f59e0b,#fbbf24)", sub: responseTimes.length ? `from ${responseTimes.length} replies` : "no data", custom: avgResponseMin > 0 ? fmtDuration(avgResponseMin) : "—" },
        ].map(({ label, val, suffix, color, grad, sub, custom }) => (
          <div key={label} className={card}>
            <div className="h-[3px]" style={{ background: grad }} />
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
              <p className="text-3xl font-black mb-1" style={{ color }}>
                {custom ?? <CountUp target={val} decimals={suffix === "%" ? 1 : 0} suffix={suffix} />}
              </p>
              <p className="text-[10px] text-slate-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue at stake + conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Warm unpaid leads */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }} />
          <div className="p-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#d97706" }}>Warm Unpaid Leads</p>
                <p className="text-sm text-slate-400">Replied but never paid — potential revenue sitting untouched.</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black" style={{ color: "#d97706" }}>{fmtMoney(unpaidRevenueAtStake)}</p>
                <p className="text-[10px] text-slate-400">est. at stake</p>
              </div>
            </div>
            {loading ? (
              <div className="py-4 text-center text-sm text-slate-400">Loading…</div>
            ) : warmUnpaidList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No warm unpaid leads 🎉</p>
            ) : (
              <div className="space-y-2">
                {warmUnpaidList.map(i => (
                  <a key={i.id} href={`/admin/conversation/${i.id}`}
                     className="flex items-center justify-between px-3 py-2 rounded-xl transition-all hover:opacity-80"
                     style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{i.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{i.session_type ?? "No type"} · {new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className="text-xs font-black ml-3 flex-shrink-0" style={{ color: "#d97706" }}>Open →</span>
                  </a>
                ))}
                {warmUnpaid.length > 8 && (
                  <p className="text-[10px] text-slate-400 text-center pt-1">+{warmUnpaid.length - 8} more</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Funnel visual */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad12 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-5" style={{ color: C.p1 }}>Booking Funnel</p>
            {[
              { label: "Inquiries received", val: total,   color: C.p1 },
              { label: "Replied to",         val: replied, color: C.p2 },
              { label: "Booked & paid",      val: paid,    color: "#10b981" },
            ].map((step, i, arr) => {
              const pct = arr[0].val > 0 ? (step.val / arr[0].val) * 100 : 0;
              const dropPct = i > 0 && arr[i - 1].val > 0
                ? ((arr[i - 1].val - step.val) / arr[i - 1].val) * 100
                : null;
              return (
                <div key={step.label} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-700">{step.label}</span>
                    <div className="flex items-center gap-2">
                      {dropPct !== null && dropPct > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                          -{dropPct.toFixed(0)}% drop
                        </span>
                      )}
                      <span className="text-sm font-black" style={{ color: step.color }}>{step.val}</span>
                    </div>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                    <Bar pct={pct} color={step.color} delay={i * 120} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{pct.toFixed(1)}% of inquiries</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* School breakdown + Lead source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* By school */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad321 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p2 }}>Inquiries by School</p>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : schoolData.length === 0 ? (
              <p className="text-sm text-slate-400">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {schoolData.map((s, i) => {
                  const convRate = s.count > 0 ? (s.paid / s.count) * 100 : 0;
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{s.emoji}</span>
                          <span className="text-sm font-bold text-slate-700">{s.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>
                            {convRate.toFixed(0)}% conv
                          </span>
                        </div>
                        <span className="text-sm font-black" style={{ color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>
                          {s.count}
                        </span>
                      </div>
                      <Bar pct={(s.count / maxSchool) * 100} color={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} delay={i * 60} />
                      <p className="text-[10px] text-slate-400 mt-1">{s.paid} paid · {s.count - s.paid} unpaid</p>
                    </div>
                  );
                })}
                {otherSchool.count > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎓</span>
                        <span className="text-sm font-bold text-slate-400">Other / Unknown</span>
                      </div>
                      <span className="text-sm font-black text-slate-400">{otherSchool.count}</span>
                    </div>
                    <Bar pct={(otherSchool.count / maxSchool) * 100} color="#cbd5e1" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* By lead source */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad12 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.p1 }}>Lead Source</p>
            <p className="text-xs text-slate-400 mb-4">Detected from inquiry message text.</p>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : knownSources.length === 0 && unknownSource.count === 0 ? (
              <p className="text-sm text-slate-400">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {knownSources.map((s, i) => {
                  const convRate = s.count > 0 ? (s.paid / s.count) * 100 : 0;
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{s.emoji}</span>
                          <span className="text-sm font-bold text-slate-700">{s.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>
                            {convRate.toFixed(0)}% conv
                          </span>
                        </div>
                        <span className="text-sm font-black" style={{ color: s.color }}>{s.count}</span>
                      </div>
                      <Bar pct={(s.count / maxSource) * 100} color={s.color} delay={i * 60} />
                      <p className="text-[10px] text-slate-400 mt-1">{s.paid} paid · {s.count - s.paid} unpaid</p>
                    </div>
                  );
                })}
                {unknownSource.count > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">❓</span>
                        <span className="text-sm font-bold text-slate-400">Unknown / Direct</span>
                      </div>
                      <span className="text-sm font-black text-slate-400">{unknownSource.count}</span>
                    </div>
                    <Bar pct={(unknownSource.count / maxSource) * 100} color="#cbd5e1" />
                    <p className="text-[10px] text-slate-400 mt-1">{unknownSource.paid} paid</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session type volume */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad90 }} />
        <div className="p-6">
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.p1 }}>Inquiries by Session Type</p>
          <p className="text-xs text-slate-400 mb-5">Volume of inquiries + conversion per type.</p>
          {loading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : typeData.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {typeData.map(([type, stats], i) => {
                const convRate = stats.count > 0 ? (stats.paid / stats.count) * 100 : 0;
                const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
                return (
                  <div key={type} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-700 truncate">{type}</span>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: convRate > 50 ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.1)", color: convRate > 50 ? "#10b981" : "#94a3b8" }}>
                            {convRate.toFixed(0)}% booked
                          </span>
                          <span className="text-sm font-black" style={{ color }}>{stats.count}</span>
                        </div>
                      </div>
                      <Bar pct={(stats.count / maxTypeCount) * 100} color={color} delay={i * 60} />
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
