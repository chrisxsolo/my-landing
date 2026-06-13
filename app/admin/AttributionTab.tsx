"use client";
// Full-funnel revenue attribution dashboard. Answers "what created the money":
// revenue by source / landing page / school / blog post / IG campaign, plus
// time-to-payment, funnel depth, and estimator→inquiry conversion. Tracked
// numbers (real first-party signal) are visually separated from inferred
// (message-text guess) and pre-tracking (no signal) so nothing reads as certain
// when it isn't.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import type { AttributionReport, DimensionRow, SourceRow } from "@/lib/attribution/types";

const panel = { background: T.panel, border: `1px solid ${T.border}`, boxShadow: T.shadow } as const;
const card = "rounded-2xl overflow-hidden";
const BARS = [T.green, T.blue, T.violet, T.amber, T.red, T.inkSoft];

function fmtCents(c: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(c / 100);
}

function Bar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 80); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.inset }}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, transition: "width 0.65s cubic-bezier(0.22,1,0.36,1)" }} />
    </div>
  );
}

const CONFIDENCE: Record<string, { label: string; color: string; bg: string }> = {
  tracked: { label: "tracked", color: T.green, bg: T.greenBg },
  inferred: { label: "inferred", color: T.amber, bg: T.amberBg },
  none: { label: "pre-tracking", color: T.inkFaint, bg: T.neutralBg },
};

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className={`adm-rise ${card}`} style={panel}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: T.inkSoft }}>{label}</p>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        </div>
        <p className="text-2xl font-black mb-1 tabular-nums" style={{ color: T.ink }}>{value}</p>
        <p className="text-[10px]" style={{ color: T.inkFaint }}>{sub}</p>
      </div>
    </div>
  );
}

function SourceSection({ rows }: { rows: SourceRow[] }) {
  const max = Math.max(...rows.map((r) => r.revenueCents), 1);
  return (
    <div className={`adm-rise ${card}`} style={panel}>
      <div className="p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: T.inkSoft }}>Revenue by Source</p>
        <p className="text-xs mb-4" style={{ color: T.inkFaint }}>Inquiries, booking rate, and booked revenue per channel.</p>
        {rows.length === 0 ? <Empty /> : (
          <div className="space-y-4">
            {rows.map((s, i) => {
              const conf = CONFIDENCE[s.confidence];
              return (
                <div key={s.key}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold truncate" style={{ color: T.ink }}>{s.label}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: conf.bg, color: conf.color }}>{conf.label}</span>
                    </div>
                    <span className="text-sm font-black tabular-nums flex-shrink-0" style={{ color: BARS[i % BARS.length] }}>{fmtCents(s.revenueCents)}</span>
                  </div>
                  <Bar pct={(s.revenueCents / max) * 100} color={BARS[i % BARS.length]} />
                  <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>
                    {s.inquiries} inquiries · {s.booked} booked · {(s.bookingRate * 100).toFixed(0)}% booking rate
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DimSection({ title, hint, rows, emptyNote }: { title: string; hint: string; rows: DimensionRow[]; emptyNote?: string }) {
  const max = Math.max(...rows.map((r) => r.revenueCents), 1);
  return (
    <div className={`adm-rise ${card}`} style={panel}>
      <div className="p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: T.inkSoft }}>{title}</p>
        <p className="text-xs mb-4" style={{ color: T.inkFaint }}>{hint}</p>
        {rows.length === 0 ? <Empty note={emptyNote} /> : (
          <div className="space-y-4">
            {rows.slice(0, 8).map((r, i) => (
              <div key={r.key}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-sm font-bold truncate" style={{ color: T.ink }}>{r.label}</span>
                  <span className="text-sm font-black tabular-nums flex-shrink-0" style={{ color: BARS[i % BARS.length] }}>{fmtCents(r.revenueCents)}</span>
                </div>
                <Bar pct={(r.revenueCents / max) * 100} color={BARS[i % BARS.length]} />
                <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>{r.inquiries} inquiries · {r.booked} booked</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ note }: { note?: string }) {
  return <p className="text-sm py-2" style={{ color: T.inkFaint }}>{note ?? "No data yet."}</p>;
}

export default function AttributionTab() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AttributionReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/attribution");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load.");
      setReport(json.report as AttributionReport);
    } catch (e) {
      console.error("[AttributionTab] load failed:", e);
      setError(e instanceof Error ? e.message : "Failed to load.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const t = report?.totals;
  const coverage = t && t.inquiries ? (t.tracked / t.inquiries) * 100 : 0;
  const est = report?.estimatorToInquiry;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`adm-rise ${card}`} style={panel}>
        <div className="p-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5" style={{ color: T.action, fontFamily: T.mono }}>Revenue Attribution</p>
            <h2 className="text-2xl font-semibold leading-tight" style={{ color: T.ink, fontFamily: T.display }}>What actually created the money.</h2>
            <p className="mt-1.5 text-sm font-medium" style={{ color: T.inkFaint }}>
              {t ? <>{t.tracked} of {t.inquiries} inquiries tracked first-party · {t.inferred} inferred · {t.unattributed} pre-tracking</> : "Loading…"}
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:-translate-y-px disabled:opacity-50 self-start"
            style={{ background: T.action, color: T.actionText }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className={card} style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}>
          <p className="p-4 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Stat row */}
      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Attributed Revenue" accent={T.green}
            value={fmtCents(t.attributedRevenueCents)}
            sub={`of ${fmtCents(t.totalRevenueCents)} collected`} />
          <StatCard label="Tracking Coverage" accent={T.blue}
            value={`${coverage.toFixed(0)}%`}
            sub={`${t.tracked} tracked · ${t.inferred} inferred`} />
          <StatCard label="Avg Days to Pay" accent={T.violet}
            value={report.avgDaysFirstVisitToPayment != null ? report.avgDaysFirstVisitToPayment.toFixed(1) : "—"}
            sub="first visit → first $" />
          <StatCard label="Pages / Inquiry" accent={T.amber}
            value={report.pagesViewedBeforeInquiry != null ? report.pagesViewedBeforeInquiry.toFixed(1) : "—"}
            sub="viewed before inquiry" />
          <StatCard label="Estimator → Inquiry" accent={T.red}
            value={est && est.rate != null ? `${(est.rate * 100).toFixed(0)}%` : "—"}
            sub={est ? `${est.convertedToInquiry}/${est.estimatorCompletions} completions` : "no data"} />
        </div>
      )}

      {report && (
        <>
          <SourceSection rows={report.bySource} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <DimSection title="Revenue by Landing Page" hint="First page each booked visitor arrived on." rows={report.byLandingPage}
              emptyNote="No tracked landing pages yet — accrues after deploy." />
            <DimSection title="Revenue by School" hint="Detected from inquiry school/message text." rows={report.bySchool} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <DimSection title="Revenue per Blog Post" hint="Bookings whose first visit landed on a blog post." rows={report.byBlogPost}
              emptyNote="No blog-sourced bookings tracked yet." />
            <DimSection title="Instagram Campaigns" hint="By utm_campaign on Instagram-sourced visits." rows={report.byInstagramCampaign}
              emptyNote="Tag IG links with ?utm_source=instagram&utm_campaign=… to populate." />
          </div>

          <p className="text-[11px] leading-relaxed px-1" style={{ color: T.inkFaint }}>
            <strong style={{ color: T.inkSoft }}>How to read this.</strong> “Tracked” means the inquiry is stitched to a first-party visitor
            session (real UTM/referrer). “Inferred” is the legacy guess from message text — treat as a hint. “Pre-tracking” is revenue
            booked before analytics shipped. Coverage rises as new traffic flows through the funnel.
          </p>
        </>
      )}
    </div>
  );
}
