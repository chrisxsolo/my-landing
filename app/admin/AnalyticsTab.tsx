"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

type ViewEvent  = { user_id:string|null; viewed_at:string; referrer:string|null; device:string|null };
type ClickEvent = { link_id:number|null; user_id:string|null; clicked_at:string; referrer:string|null; device:string|null };
type LinkRow    = { id:number; label:string; emoji:string|null; url:string };
type ViewMode   = "today" | "7d" | "30d" | "week";

const SOURCES = [
  { key:"instagram", label:"Instagram",       color:"#e1306c" },
  { key:"tiktok",    label:"TikTok",           color:"#00b8a9" },
  { key:"google",    label:"Google",            color:"#4285f4" },
  { key:"twitter",   label:"X / Twitter",      color:"#1da1f2" },
  { key:"facebook",  label:"Facebook",          color:"#1877f2" },
  { key:"youtube",   label:"YouTube",           color:"#ff0000" },
  { key:"direct",    label:"Direct / Unknown",  color:"#64748b" },
  { key:"other",     label:"Other",             color:"#a78bfa" },
] as const;

const DEV_COLORS: Record<string, string> = {
  mobile: "#9d6fe8",
  tablet: "#e879a0",
  desktop: "#22d3ee",
};

const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function fmt12h(h: number): string {
  if (h === 0)  return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function dateFromKey(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoDay(d: Date) { return d.toISOString().split("T")[0]; }

function periodStart(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday-anchored week start, offset by N weeks back
function getWeekStart(weeksBack: number): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const daysToMon = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToMon - weeksBack * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildRangeStats(start: Date, end: Date, clicks: ClickEvent[], views: ViewEvent[]) {
  const map: Record<string, { clicks: number; views: number }> = {};
  const cur = new Date(start);
  while (cur <= end) {
    map[isoDay(cur)] = { clicks: 0, views: 0 };
    cur.setDate(cur.getDate() + 1);
  }
  views.forEach(v => { const k = v.viewed_at?.split("T")[0]; if (k && map[k]) map[k].views++; });
  clicks.forEach(c => { const k = c.clicked_at?.split("T")[0]; if (k && map[k]) map[k].clicks++; });
  return Object.entries(map)
    .map(([date, s]) => ({ date, ...s, ctr: s.views > 0 ? (s.clicks / s.views) * 100 : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function CountUp({ target, color, className }: { target: number; color?: string; className?: string }) {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const t0 = performance.now();
    const dur = 700;
    function tick(now: number) {
      const t = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * ease));
      if (t < 1) requestAnimationFrame(tick);
      else prevRef.current = target;
    }
    requestAnimationFrame(tick);
  }, [target]);
  return <span className={className} style={color ? { color } : undefined}>{fmtNum(val)}</span>;
}

function TrendBadge({ curr, prev, label }: { curr: number; prev: number; label?: string }) {
  if (!prev && !curr) return null;
  const pct = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: up ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: up ? "#10b981" : "#ef4444" }}
      title={label}
    >
      {up ? "↑" : "↓"}{Math.abs(Math.round(pct))}%
    </span>
  );
}

const MAX_WEEKS_BACK = 12;

export default function AnalyticsTab() {
  const [loading, setLoading]       = useState(true);
  const [views, setViews]           = useState<ViewEvent[]>([]);
  const [clicks, setClicks]         = useState<ClickEvent[]>([]);
  const [links, setLinks]           = useState<LinkRow[]>([]);
  const [viewMode, setViewMode]     = useState<ViewMode>("today");
  const [weeksBack, setWeeksBack]   = useState(0);
  const [hoverIdx, setHoverIdx]     = useState<number | null>(null);
  const [hoverHour, setHoverHour]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = periodStart(MAX_WEEKS_BACK * 7 + 7).toISOString();
    const [{ data: v }, { data: c }, { data: l }] = await Promise.all([
      supabase.from("link_views").select("user_id,viewed_at,referrer,device").gte("viewed_at", since),
      supabase.from("link_clicks").select("link_id,user_id,clicked_at,referrer,device").gte("clicked_at", since),
      supabase.from("links").select("id,label,emoji,url").eq("active", true).order("order", { ascending: true }),
    ]);
    setViews((v ?? []) as ViewEvent[]);
    setClicks((c ?? []) as ClickEvent[]);
    setLinks((l ?? []) as LinkRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derive date boundaries ────────────────────────────────────────────
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let currStart: Date, currEnd: Date, prevStart: Date, prevEnd: Date;
  let periodLabel = "";

  if (viewMode === "today") {
    currStart = new Date(); currStart.setHours(0, 0, 0, 0);
    currEnd   = now;
    prevStart = new Date(currStart); prevStart.setDate(prevStart.getDate() - 1);
    prevEnd   = new Date(now);       prevEnd.setDate(prevEnd.getDate() - 1);
    periodLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } else if (viewMode === "week") {
    currStart = getWeekStart(weeksBack);
    currEnd   = new Date(currStart); currEnd.setDate(currStart.getDate() + 6); currEnd.setHours(23, 59, 59, 999);
    prevStart = getWeekStart(weeksBack + 1);
    prevEnd   = new Date(prevStart); prevEnd.setDate(prevStart.getDate() + 6); prevEnd.setHours(23, 59, 59, 999);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    periodLabel = `${fmt(currStart)} – ${fmt(currEnd)}`;
  } else {
    const days = viewMode === "7d" ? 7 : 30;
    currStart = periodStart(days); currEnd = now;
    prevStart = periodStart(days * 2); prevEnd = new Date(currStart); prevEnd.setMilliseconds(-1);
    periodLabel = `Last ${days} days`;
  }

  const inRange   = (ts: string, s: Date, e: Date) => { const d = new Date(ts); return d >= s && d <= e; };
  const currViews  = views.filter(v => inRange(v.viewed_at, currStart, currEnd));
  const prevViews  = views.filter(v => inRange(v.viewed_at, prevStart, prevEnd));
  const currClicks = clicks.filter(c => inRange(c.clicked_at, currStart, currEnd));
  const prevClicks = clicks.filter(c => inRange(c.clicked_at, prevStart, prevEnd));

  const totalViews      = currViews.length;
  const prevTotalViews  = prevViews.length;
  const totalClicks     = currClicks.length;
  const prevTotalClicks = prevClicks.length;
  const uniqueVisitors     = new Set(currViews.map(v => v.user_id).filter(Boolean)).size;
  const prevUniqueVisitors = new Set(prevViews.map(v => v.user_id).filter(Boolean)).size;
  const uniqueClickers     = new Set(currClicks.map(c => c.user_id).filter(Boolean)).size;
  const prevUniqueClickers = new Set(prevClicks.map(c => c.user_id).filter(Boolean)).size;
  const overallCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

  // ── Referrer breakdown ────────────────────────────────────────────────
  const refMap: Record<string, number> = {};
  currViews.forEach(v => { const k = v.referrer ?? "direct"; refMap[k] = (refMap[k] ?? 0) + 1; });
  const sourceData = SOURCES
    .map(s => ({ ...s, count: refMap[s.key] ?? 0, pct: totalViews > 0 ? ((refMap[s.key] ?? 0) / totalViews) * 100 : 0 }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // ── Device breakdown ──────────────────────────────────────────────────
  const devMap: Record<string, number> = { mobile: 0, tablet: 0, desktop: 0 };
  currViews.forEach(v => { const d = v.device ?? "desktop"; devMap[d] = (devMap[d] ?? 0) + 1; });
  const devTotal = Object.values(devMap).reduce((a, b) => a + b, 0);

  // ── Hour heatmap ──────────────────────────────────────────────────────
  const hourData = Array(24).fill(0) as number[];
  currViews.forEach(v => { if (v.viewed_at) hourData[new Date(v.viewed_at).getHours()]++; });
  const maxHourVal = Math.max(...hourData, 1);
  const peakHour   = hourData.indexOf(Math.max(...hourData));

  // ── Per-link stats ────────────────────────────────────────────────────
  const clicksByLink = new Map<number, ClickEvent[]>();
  currClicks.forEach(c => {
    if (!c.link_id) return;
    const arr = clicksByLink.get(c.link_id) ?? [];
    arr.push(c);
    clicksByLink.set(c.link_id, arr);
  });
  const linkStats = links.map(l => {
    const lc = clicksByLink.get(l.id) ?? [];
    return {
      ...l,
      clicks: lc.length,
      uniqueClickers: new Set(lc.map(c => c.user_id).filter(Boolean)).size,
      ctr: totalViews > 0 ? (lc.length / totalViews) * 100 : 0,
      clickShare: totalClicks > 0 ? (lc.length / totalClicks) * 100 : 0,
      isDead: lc.length === 0,
    };
  }).sort((a, b) => b.clicks - a.clicks);

  // ── Daily stats for chart ─────────────────────────────────────────────
  const dailyStats = buildRangeStats(currStart, viewMode === "week" ? currEnd : now, currClicks, currViews);
  const busiestDay = dailyStats.reduce<(typeof dailyStats)[0] | null>(
    (best, s) => !best || s.clicks + s.views > best.clicks + best.views ? s : best, null
  );

  async function clearAll() {
    if (!confirm("⚠️ Permanently delete ALL analytics data (views + clicks)?")) return;
    await Promise.all([
      supabase.from("link_clicks").delete().neq("id", 0),
      supabase.from("link_views").delete().neq("id", 0),
    ]);
    load();
  }

  const trendLabel = viewMode === "today"
    ? "vs. yesterday (same time)"
    : viewMode === "week"
    ? `vs. week of ${getWeekStart(weeksBack + 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : `vs. previous ${viewMode === "7d" ? 7 : 30} days`;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad90 }} />
        <div className="p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: C.p1 }}>Linktree Analytics</p>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Views, clicks, and where people come from.</h2>
            <p className="mt-1.5 text-sm font-medium text-slate-400">
              Trend arrows compare to {trendLabel}.
            </p>
          </div>

          {/* Time controls */}
          <div className="flex flex-col gap-2 md:items-end">
            {/* Mode picker */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-50 border border-slate-100">
              {(["today", "7d", "30d", "week"] as ViewMode[]).map(m => (
                <button key={m} onClick={() => { setViewMode(m); if (m !== "week") setWeeksBack(0); }}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={viewMode === m ? { background: C.p1_10, color: C.p1 } : { color: "#94a3b8" }}>
                  {m === "today" ? "Today" : m === "7d" ? "7 days" : m === "30d" ? "30 days" : "Week"}
                </button>
              ))}
            </div>

            {/* Week navigator */}
            {viewMode === "week" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeeksBack(w => Math.min(w + 1, MAX_WEEKS_BACK))}
                  disabled={weeksBack >= MAX_WEEKS_BACK}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: C.p1_10, color: C.p1 }}>‹</button>
                <span className="text-xs font-bold text-slate-600 min-w-[130px] text-center">{periodLabel}</span>
                <button
                  onClick={() => setWeeksBack(w => Math.max(w - 1, 0))}
                  disabled={weeksBack === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: C.p1_10, color: C.p1 }}>›</button>
              </div>
            )}

            <button onClick={load} disabled={loading}
              className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: C.p2_08, color: C.p2 }}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Views",     val: totalViews,     prev: prevTotalViews,     color: C.p1, grad: C.grad12  },
          { label: "Unique Visitors", val: uniqueVisitors, prev: prevUniqueVisitors, color: C.p3, grad: C.grad321 },
          { label: "Total Clicks",    val: totalClicks,    prev: prevTotalClicks,    color: C.p2, grad: C.grad23  },
          { label: "Unique Clickers", val: uniqueClickers, prev: prevUniqueClickers, color: C.p1, grad: C.grad90  },
        ].map(({ label, val, prev, color, grad }) => (
          <div key={label} className={card}>
            <div className="h-[3px]" style={{ background: grad }} />
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
              <div className="flex items-end justify-between gap-2 mb-1">
                <CountUp target={val} color={color} className="text-3xl font-black" />
                {!loading && <TrendBadge curr={val} prev={prev} label={trendLabel} />}
              </div>
              <p className="text-[10px] text-slate-300">prev: {fmtNum(prev)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sources + Devices ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Traffic sources */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad321 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p2 }}>Traffic Sources</p>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : sourceData.length === 0 ? (
              <p className="text-sm text-slate-400">No referrer data yet.</p>
            ) : (
              <div className="space-y-3.5">
                {sourceData.map(s => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-700">{s.label}</span>
                      <span className="text-sm font-black" style={{ color: s.color }}>{fmtPct(s.pct)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtNum(s.count)} visit{s.count !== 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Device breakdown */}
        <div className={card}>
          <div className="h-[3px]" style={{ background: C.grad12 }} />
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p1 }}>Device Breakdown</p>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
            ) : devTotal === 0 ? (
              <p className="text-sm text-slate-400">No device data yet.</p>
            ) : (
              <>
                <div className="flex rounded-full overflow-hidden h-5 mb-5">
                  {(["mobile", "desktop", "tablet"] as const).map(key => {
                    const pct = devTotal > 0 ? (devMap[key] ?? 0) / devTotal * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div key={key} className="h-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: DEV_COLORS[key] }}
                        title={`${key}: ${fmtPct(pct)}`} />
                    );
                  })}
                </div>
                <div className="space-y-2.5">
                  {(["mobile", "desktop", "tablet"] as const).map(key => {
                    const emoji = { mobile: "📱", desktop: "💻", tablet: "⬜" }[key];
                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                    const count = devMap[key] ?? 0;
                    const pct = devTotal > 0 ? (count / devTotal) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DEV_COLORS[key] }} />
                          <span className="text-sm font-medium text-slate-600">{emoji} {label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{fmtNum(count)}</span>
                          <span className="text-sm font-black w-12 text-right" style={{ color: DEV_COLORS[key] }}>{fmtPct(pct)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Hour heatmap ────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad90_23 }} />
        <div className="p-6">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.p1 }}>Traffic by Hour</p>
              <p className="text-sm font-medium text-slate-400">When does your page get the most traffic?</p>
            </div>
            {totalViews > 0 && (
              <p className="text-xs font-bold text-slate-400">
                Peak: {fmt12h(peakHour)}–{fmt12h(peakHour + 1 === 24 ? 0 : peakHour + 1)} · {fmtNum(hourData[peakHour])} views
              </p>
            )}
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
            {hourData.map((count, h) => {
              const intensity = count / maxHourVal;
              return (
                <div key={h} className="relative group">
                  <div
                    className="rounded-md w-full aspect-square transition-transform duration-150 group-hover:scale-110 cursor-default"
                    style={{
                      background: count > 0
                        ? `rgba(157,111,232,${(0.12 + intensity * 0.88).toFixed(2)})`
                        : "rgba(241,245,249,0.8)",
                    }}
                    onMouseEnter={() => setHoverHour(h)}
                    onMouseLeave={() => setHoverHour(null)}
                  />
                  {hoverHour === h && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 pointer-events-none">
                      <div className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap shadow-xl"
                        style={{ background: "rgba(15,15,25,0.92)", color: "white" }}>
                        {fmt12h(h)} · {fmtNum(count)} view{count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Time labels — 12-hour */}
          <div className="flex justify-between mt-2 select-none text-[10px] font-bold text-slate-300">
            {[0, 6, 12, 18, 23].map(h => <span key={h}>{fmt12h(h)}</span>)}
          </div>
          {/* Color scale */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] font-bold text-slate-300">Less</span>
            <div className="flex gap-0.5">
              {[0.12, 0.3, 0.5, 0.7, 1.0].map(op => (
                <div key={op} className="w-4 h-4 rounded-sm" style={{ background: `rgba(157,111,232,${op})` }} />
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-300">More</span>
          </div>
        </div>
      </div>

      {/* ── Engagement snapshot ─────────────────────────────────────────── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad321 }} />
        <div className="p-6">
          <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.p2 }}>Engagement Snapshot</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Click-through Rate", val: `${overallCtr.toFixed(1)}%`,                                                              color: C.p1 },
              { label: "Clicks per Visitor", val: (uniqueVisitors > 0 ? totalClicks / uniqueVisitors : 0).toFixed(2),                      color: C.p2 },
              { label: "Visitor → Clicker",  val: uniqueVisitors > 0 ? `${((uniqueClickers / uniqueVisitors) * 100).toFixed(1)}%` : "0.0%", color: "#d97706" },
              { label: "Active Links",        val: fmtNum(links.length),                                                                    color: C.p3 },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-100 p-4" style={{ background: "rgba(248,250,252,0.8)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{item.label}</p>
                <p className="text-2xl font-black" style={{ color: item.color }}>{item.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Activity over time (hidden for Today — heatmap is sufficient) ── */}
      {viewMode !== "today" && <div className="bg-white rounded-2xl border border-slate-100">
        <div className="h-[3px]" style={{ background: C.grad90 }} />
        <div className="p-6">
          <div className="flex flex-col gap-1 mb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">Activity Over Time</h3>
              <p className="text-xs font-medium text-slate-400">
                {viewMode === "week" ? `${periodLabel}` : `Views and clicks per day.`}
              </p>
            </div>
            {busiestDay && busiestDay.views + busiestDay.clicks > 0 && (
              <p className="text-xs font-bold text-slate-400">
                Busiest: {dateFromKey(busiestDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtNum(busiestDay.views + busiestDay.clicks)} events
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading chart…</div>
          ) : (
            <div style={{ overflowX: "auto", paddingBottom: 8 }}>
              <div className="relative" style={{ minWidth: viewMode === "week" ? 280 : 520 }}>
                {/* Tooltip */}
                <div className="relative h-12 pointer-events-none">
                  {hoverIdx !== null && dailyStats[hoverIdx] && (() => {
                    const s = dailyStats[hoverIdx];
                    const d = dateFromKey(s.date);
                    const col = hoverIdx / Math.max(dailyStats.length - 1, 1);
                    const leftPct = Math.min(Math.max(col * 100, 5), 82);
                    return (
                      <div className="absolute top-1 z-20 transition-all duration-100"
                        style={{ left: `${leftPct}%`, transform: col > 0.7 ? "translateX(-90%)" : col < 0.2 ? "translateX(-5%)" : "translateX(-50%)" }}>
                        <div className="rounded-xl px-3 py-2 shadow-xl whitespace-nowrap"
                          style={{ background: "rgba(15,15,25,0.92)", backdropFilter: "blur(8px)" }}>
                          <p className="text-xs font-bold text-white mb-1">
                            {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                          <div className="flex gap-3">
                            <span className="text-xs" style={{ color: "rgba(157,111,232,0.9)" }}>👁 {s.views}</span>
                            <span className="text-xs" style={{ color: "rgba(232,121,160,0.9)" }}>🔗 {s.clicks}</span>
                            <span className="text-xs text-white/60">{s.ctr.toFixed(1)}% CTR</span>
                          </div>
                        </div>
                        <div className="w-2 h-2 rotate-45 mt-[-4px] mx-auto" style={{ background: "rgba(15,15,25,0.92)" }} />
                      </div>
                    );
                  })()}
                </div>
                {/* Bars */}
                <div className="flex items-end justify-between gap-1.5 px-2" style={{ height: 200 }}>
                  {dailyStats.map((stat, i) => {
                    const maxVal = Math.max(...dailyStats.map(s => Math.max(s.clicks, s.views)), 1);
                    const ch = (stat.clicks / maxVal) * 100;
                    const vh = (stat.views / maxVal) * 100;
                    const date = dateFromKey(stat.date);
                    const isHov = hoverIdx === i;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer"
                        onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                        <div className="w-full flex gap-0.5 items-end"
                          style={{ height: 168, transform: isHov ? "scaleY(1.04)" : "scaleY(1)", transformOrigin: "bottom", transition: "transform 0.15s" }}>
                          <div className="flex-1 rounded-t-md transition-all duration-300"
                            style={{ height: `${vh}%`, minHeight: vh > 0 ? 4 : 0, background: isHov ? `linear-gradient(180deg,${C.p1},${C.p1}88)` : `linear-gradient(180deg,${C.p1}50,${C.p1}28)` }} />
                          <div className="flex-1 rounded-t-md transition-all duration-300"
                            style={{ height: `${ch}%`, minHeight: ch > 0 ? 4 : 0, background: isHov ? `linear-gradient(180deg,${C.p2},${C.p2}88)` : `linear-gradient(180deg,${C.p2}50,${C.p2}28)` }} />
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black" style={{ color: isHov ? C.p1 : "#1e293b" }}>{date.getDate()}</p>
                          <p className="text-[8px] font-bold uppercase" style={{ color: isHov ? C.p1 : "#cbd5e1" }}>
                            {date.toLocaleDateString("en-US", { weekday: "short" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Grid lines */}
                <div className="absolute pointer-events-none flex flex-col justify-between px-2"
                  style={{ top: 48, left: 0, right: 0, bottom: 40 }}>
                  {[...Array(4)].map((_, i) => <div key={i} className="w-full h-px" style={{ background: "rgba(0,0,0,0.04)" }} />)}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t" style={{ borderColor: C.p1_08 }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: C.p1 }} />
              <span className="text-xs font-bold text-slate-500">Page Views</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: C.p2 }} />
              <span className="text-xs font-bold text-slate-500">Link Clicks</span>
            </div>
          </div>
        </div>
      </div>

      }

      {/* ── Link performance ────────────────────────────────────────────── */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad90_23 }} />
        <div className="p-6">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900">Link Performance</h2>
              <p className="text-xs font-medium text-slate-400">Ranked by clicks. Zero-click links are flagged.</p>
            </div>
            <a href="/admin/links" className="text-xs font-bold transition-colors hover:opacity-70" style={{ color: C.p2 }}>Manage links →</a>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : linkStats.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">No links found.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {linkStats.map((stat, idx) => {
                const maxClicks = linkStats.find(s => !s.isDead)?.clicks || 1;
                const barW = (stat.clicks / maxClicks) * 100;
                return (
                  <div key={stat.id} className="p-4 rounded-xl border relative overflow-hidden transition-shadow hover:shadow-sm"
                    style={{ borderColor: stat.isDead ? "rgba(239,68,68,0.2)" : "rgba(241,245,249,1)" }}>
                    <div className="absolute inset-0 rounded-xl"
                      style={{ background: `linear-gradient(90deg,${C.p1_06} ${barW}%,transparent ${barW}%)` }} />
                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black flex-shrink-0"
                          style={{ background: idx === 0 ? C.p1_15 : idx === 1 ? C.p2_10 : idx === 2 ? C.p3_10 : C.p1_06, color: idx < 3 ? C.p1 : "#94a3b8" }}>
                          #{idx + 1}
                        </div>
                        <span className="text-xl flex-shrink-0">{stat.emoji || "🔗"}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-sm text-slate-900 truncate">{stat.label}</p>
                            {stat.isDead && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                                no clicks
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">{stat.url}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 flex-shrink-0 text-right">
                        {[
                          { val: fmtNum(stat.clicks),          label: "clicks", color: stat.isDead ? "#94a3b8" : C.p1 },
                          { val: fmtNum(stat.uniqueClickers),  label: "uniq",   color: C.p3 },
                          { val: `${stat.ctr.toFixed(1)}%`,    label: "CTR",    color: C.p2 },
                          { val: `${stat.clickShare.toFixed(1)}%`, label: "share", color: C.p1 },
                        ].map(({ val, label, color }) => (
                          <div key={label}>
                            <p className="text-lg font-black" style={{ color }}>{val}</p>
                            <p className="text-[9px] font-bold uppercase text-slate-300">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Danger zone ─────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-700">Clear all analytics</p>
            <p className="text-xs text-slate-400">Permanently deletes all view and click records.</p>
          </div>
          <button onClick={clearAll}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
            Clear all
          </button>
        </div>
      </div>

    </div>
  );
}
