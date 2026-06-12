"use client";
import { useState, useEffect, useCallback } from "react";
import { T } from "@/app/admin/adminTheme";
import { loadAdminInquiries, type AdminInquiry } from "@/lib/adminInquiries";

const panel = { background: T.panel, border: `1px solid ${T.border}`, boxShadow: T.shadow } as const;
const card = "rounded-2xl overflow-hidden";

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
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.inset }}>
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

  const FUNNEL_COLORS = [T.violet, T.blue, T.green, T.amber, T.red, T.inkSoft];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className={`adm-rise ${card}`} style={panel}>
        <div className="p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5" style={{ color: T.action, fontFamily: T.mono }}>Funnel Analytics</p>
            <h2 className="text-2xl font-semibold leading-tight" style={{ color: T.ink, fontFamily: T.display }}>Where your clients come from — and where they drop.</h2>
            <p className="mt-1.5 text-sm font-medium" style={{ color: T.inkFaint }}>Based on {total} real inquiries.</p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:-translate-y-px disabled:opacity-50 self-start"
            style={{ background: T.action, color: T.actionText }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Funnel stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Inquiries",    val: total,          suffix: "",  accent: T.blue,   sub: "all time" },
          { label: "Reply Rate",         val: replyRate,      suffix: "%", accent: T.violet, sub: `${replied} replied` },
          { label: "Booking Conversion", val: conversionRate, suffix: "%", accent: T.green,  sub: `${paid} paid` },
          { label: "Avg Response Time",  val: 0, suffix: "",  accent: T.amber,  sub: responseTimes.length ? `from ${responseTimes.length} replies` : "no data", custom: avgResponseMin > 0 ? fmtDuration(avgResponseMin) : "—" },
        ].map(({ label, val, suffix, accent, sub, custom }, i) => (
          <div key={label} className={`adm-rise ${card} transition-all duration-200 hover:-translate-y-0.5`} style={{ ...panel, animationDelay: `${60 + i * 50}ms` }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: T.inkSoft }}>{label}</p>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              </div>
              <p className="text-3xl font-black mb-1 tabular-nums" style={{ color: T.ink }}>
                {custom ?? <CountUp target={val} decimals={suffix === "%" ? 1 : 0} suffix={suffix} />}
              </p>
              <p className="text-[10px]" style={{ color: T.inkFaint }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue at stake + conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Warm unpaid leads */}
        <div className={`adm-rise ${card}`} style={{ background: T.panel, border: `1px solid ${T.amberBorder}`, boxShadow: T.shadow, animationDelay: "160ms" }}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: T.amber }}>Warm Unpaid Leads</p>
                <p className="text-sm" style={{ color: T.inkFaint }}>Replied but never paid — potential revenue sitting untouched.</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black tabular-nums" style={{ color: T.amber }}>{fmtMoney(unpaidRevenueAtStake)}</p>
                <p className="text-[10px]" style={{ color: T.inkFaint }}>est. at stake</p>
              </div>
            </div>
            {loading ? (
              <div className="py-4 text-center text-sm" style={{ color: T.inkFaint }}>Loading…</div>
            ) : warmUnpaidList.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: T.inkFaint }}>No warm unpaid leads 🎉</p>
            ) : (
              <div className="space-y-2">
                {warmUnpaidList.map(i => (
                  <a key={i.id} href={`/admin/conversation/${i.id}`}
                     className="group flex items-center justify-between px-3 py-2 rounded-xl transition-all hover:-translate-y-px"
                     style={{ background: T.amberBg }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate" style={{ color: T.ink }}>{i.name}</p>
                      <p className="text-[10px] truncate" style={{ color: T.inkFaint }}>{i.session_type ?? "No type"} · {new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className="text-xs font-black ml-3 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: T.amber }}>Open →</span>
                  </a>
                ))}
                {warmUnpaid.length > 8 && (
                  <p className="text-[10px] text-center pt-1" style={{ color: T.inkFaint }}>+{warmUnpaid.length - 8} more</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Funnel visual */}
        <div className={`adm-rise ${card}`} style={{ ...panel, animationDelay: "200ms" }}>
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-5" style={{ color: T.inkSoft }}>Booking Funnel</p>
            {[
              { label: "Inquiries received", val: total,   color: T.blue },
              { label: "Replied to",         val: replied, color: T.violet },
              { label: "Booked & paid",      val: paid,    color: T.green },
            ].map((step, i, arr) => {
              const pct = arr[0].val > 0 ? (step.val / arr[0].val) * 100 : 0;
              const dropPct = i > 0 && arr[i - 1].val > 0
                ? ((arr[i - 1].val - step.val) / arr[i - 1].val) * 100
                : null;
              return (
                <div key={step.label} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold" style={{ color: T.ink }}>{step.label}</span>
                    <div className="flex items-center gap-2">
                      {dropPct !== null && dropPct > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: T.redBg, color: T.red }}>
                          -{dropPct.toFixed(0)}% drop
                        </span>
                      )}
                      <span className="text-sm font-black tabular-nums" style={{ color: step.color }}>{step.val}</span>
                    </div>
                  </div>
                  <Bar pct={pct} color={step.color} delay={i * 120} />
                  <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>{pct.toFixed(1)}% of inquiries</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* School breakdown + Lead source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* By school */}
        <div className={`adm-rise ${card}`} style={{ ...panel, animationDelay: "240ms" }}>
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-4" style={{ color: T.inkSoft }}>Inquiries by School</p>
            {loading ? (
              <div className="py-6 text-center text-sm" style={{ color: T.inkFaint }}>Loading…</div>
            ) : schoolData.length === 0 ? (
              <p className="text-sm" style={{ color: T.inkFaint }}>No data yet.</p>
            ) : (
              <div className="space-y-4">
                {schoolData.map((s, i) => {
                  const convRate = s.count > 0 ? (s.paid / s.count) * 100 : 0;
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{s.emoji}</span>
                          <span className="text-sm font-bold" style={{ color: T.ink }}>{s.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: T.greenBg, color: T.green }}>
                            {convRate.toFixed(0)}% conv
                          </span>
                        </div>
                        <span className="text-sm font-black tabular-nums" style={{ color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>
                          {s.count}
                        </span>
                      </div>
                      <Bar pct={(s.count / maxSchool) * 100} color={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} delay={i * 60} />
                      <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>{s.paid} paid · {s.count - s.paid} unpaid</p>
                    </div>
                  );
                })}
                {otherSchool.count > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎓</span>
                        <span className="text-sm font-bold" style={{ color: T.inkFaint }}>Other / Unknown</span>
                      </div>
                      <span className="text-sm font-black tabular-nums" style={{ color: T.inkFaint }}>{otherSchool.count}</span>
                    </div>
                    <Bar pct={(otherSchool.count / maxSchool) * 100} color={T.insetStrong} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* By lead source */}
        <div className={`adm-rise ${card}`} style={{ ...panel, animationDelay: "280ms" }}>
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: T.inkSoft }}>Lead Source</p>
            <p className="text-xs mb-4" style={{ color: T.inkFaint }}>Detected from inquiry message text.</p>
            {loading ? (
              <div className="py-6 text-center text-sm" style={{ color: T.inkFaint }}>Loading…</div>
            ) : knownSources.length === 0 && unknownSource.count === 0 ? (
              <p className="text-sm" style={{ color: T.inkFaint }}>No data yet.</p>
            ) : (
              <div className="space-y-4">
                {knownSources.map((s, i) => {
                  const convRate = s.count > 0 ? (s.paid / s.count) * 100 : 0;
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{s.emoji}</span>
                          <span className="text-sm font-bold" style={{ color: T.ink }}>{s.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: T.greenBg, color: T.green }}>
                            {convRate.toFixed(0)}% conv
                          </span>
                        </div>
                        <span className="text-sm font-black tabular-nums" style={{ color: s.color }}>{s.count}</span>
                      </div>
                      <Bar pct={(s.count / maxSource) * 100} color={s.color} delay={i * 60} />
                      <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>{s.paid} paid · {s.count - s.paid} unpaid</p>
                    </div>
                  );
                })}
                {unknownSource.count > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">❓</span>
                        <span className="text-sm font-bold" style={{ color: T.inkFaint }}>Unknown / Direct</span>
                      </div>
                      <span className="text-sm font-black tabular-nums" style={{ color: T.inkFaint }}>{unknownSource.count}</span>
                    </div>
                    <Bar pct={(unknownSource.count / maxSource) * 100} color={T.insetStrong} />
                    <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>{unknownSource.paid} paid</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session type volume */}
      <div className={`adm-rise ${card}`} style={{ ...panel, animationDelay: "320ms" }}>
        <div className="p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: T.inkSoft }}>Inquiries by Session Type</p>
          <p className="text-xs mb-5" style={{ color: T.inkFaint }}>Volume of inquiries + conversion per type.</p>
          {loading ? (
            <div className="py-6 text-center text-sm" style={{ color: T.inkFaint }}>Loading…</div>
          ) : typeData.length === 0 ? (
            <p className="text-sm" style={{ color: T.inkFaint }}>No data yet.</p>
          ) : (
            <div className="space-y-3">
              {typeData.map(([type, stats], i) => {
                const convRate = stats.count > 0 ? (stats.paid / stats.count) * 100 : 0;
                const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
                return (
                  <div key={type} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold truncate" style={{ color: T.ink }}>{type}</span>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={convRate > 50 ? { background: T.greenBg, color: T.green } : { background: T.neutralBg, color: T.inkFaint }}>
                            {convRate.toFixed(0)}% booked
                          </span>
                          <span className="text-sm font-black tabular-nums" style={{ color }}>{stats.count}</span>
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
