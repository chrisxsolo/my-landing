"use client";
// Payment & client intelligence: ranked client table with a detail drawer,
// plus a payment-status funnel built only from real inquiry/payment fields.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminInquiry } from "@/lib/adminInquiries";
import { fmtDate, fmtMoney, fmtShare } from "@/lib/revenue/format";
import { clientKeyOf, confirmedRows, rowCents } from "@/lib/revenue/calc";
import type { LedgerRow } from "@/lib/revenue/enrich";
import { SERVICE_LABELS } from "@/lib/revenue/enrich";
import { receivablesForClient, type Receivable } from "@/lib/revenue/receivables";
import { EmptyState, GlassPanel, InfoTip, SectionHeader, Skeleton, Sparkline, useReducedMotion } from "./Glass";
import { REV } from "./palette";

type ClientAgg = {
  key: string;
  name: string;
  email: string;
  cents: number;
  payments: number;
  sessions: number;
  avgBookingCents: number;
  lastPaidAt: string | null;
  services: string[];
  share: number;
  outstandingCents: number;
  rows: LedgerRow[];
};

type SortKey = "cents" | "payments" | "lastPaidAt" | "name";

type Props = {
  loading: boolean;
  periodRows: LedgerRow[];
  inquiries: AdminInquiry[];
  receivables: Receivable[];
  periodLabel: string;
};

export default function ClientsSection({ loading, periodRows, inquiries, receivables, periodLabel }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("cents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const clients = useMemo(() => {
    const revenue = confirmedRows(periodRows);
    const total = revenue.reduce((s, p) => s + rowCents(p), 0);
    const map = new Map<string, LedgerRow[]>();
    for (const p of revenue) {
      const key = clientKeyOf(p);
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    return [...map.entries()].map(([key, rows]): ClientAgg => {
      const cents = rows.reduce((s, p) => s + rowCents(p), 0);
      const bookings = new Set(rows.map(p => (p.inquiry_id != null ? `i${p.inquiry_id}` : `c${key}`)));
      const sessions = new Set(rows.map(p => p.inquiry?.session_date ?? p.session_date).filter(Boolean));
      const sorted = [...rows].sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));
      return {
        key,
        name: rows[0].client_name,
        email: rows[0].client_email,
        cents,
        payments: rows.length,
        sessions: Math.max(sessions.size, 1),
        avgBookingCents: Math.round(cents / bookings.size),
        lastPaidAt: sorted[0]?.paid_at ?? null,
        services: [...new Set(rows.map(p => SERVICE_LABELS[p.serviceKey]))],
        share: total > 0 ? cents / total : 0,
        outstandingCents: receivablesForClient(receivables, key).reduce((s, r) => s + r.outstandingCents, 0),
        rows: sorted,
      };
    });
  }, [periodRows, receivables]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...clients].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [clients, sortKey, sortDir]);

  const visible = showAll ? sorted : sorted.slice(0, 8);
  const open = openClient ? clients.find(c => c.key === openClient) ?? null : null;

  const funnel = useMemo(() => buildFunnel(periodRows, inquiries, receivables), [periodRows, inquiries, receivables]);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const th = (label: string, key: SortKey | null, align = "text-right") => (
    <th scope="col" className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest ${align}`} style={{ color: REV.textFaint }}>
      {key ? (
        <button type="button" onClick={() => sortBy(key)} className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
          aria-label={`Sort by ${label}`}>
          {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <GlassPanel className="xl:col-span-8 p-5 overflow-hidden">
        <SectionHeader kicker="Client intelligence" title="Top clients by collected revenue"
          right={<span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>{periodLabel} · {clients.length} paying client{clients.length === 1 ? "" : "s"}</span>} />
        {loading ? <Skeleton className="h-48 w-full" /> : clients.length === 0 ? (
          <EmptyState message="No paying clients in this period." />
        ) : (
          <>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${REV.panelBorder}` }}>
                    {th("Client", "name", "text-left")}
                    {th("Collected", "cents")}
                    {th("Payments", "payments")}
                    {th("Avg booking", null)}
                    {th("Last payment", "lastPaidAt")}
                    {th("Share", null)}
                    {th("Outstanding", null)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c, i) => (
                    <tr key={c.key} className="cursor-pointer transition-colors"
                      style={{ borderBottom: `1px solid ${REV.rowBorder}` }}
                      onMouseEnter={e => { e.currentTarget.style.background = REV.inset; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => setOpenClient(c.key)}
                          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                          aria-label={`Open details for ${c.name}`}>
                          <span className="text-xs font-black hover:underline" style={{ color: REV.text }}>
                            <span className="inline-block w-5 text-[10px]" style={{ color: REV.textFaint }}>{i + 1}.</span>{c.name}
                          </span>
                          <span className="block text-[10px] font-medium pl-5" style={{ color: REV.textFaint }}>{c.services.join(" · ") || "—"}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-black" style={{ color: REV.accent }}>{fmtMoney(c.cents)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: REV.textSoft }}>{c.payments}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: REV.textSoft }}>{fmtMoney(c.avgBookingCents)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-bold whitespace-nowrap" style={{ color: REV.textSoft }}>{fmtDate(c.lastPaidAt)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: REV.textSoft }}>{fmtShare(c.share)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-black" style={{ color: c.outstandingCents > 0 ? REV.amber : REV.textFaint }}>
                        {c.outstandingCents > 0 ? `~${fmtMoney(c.outstandingCents)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 8 && (
              <button type="button" onClick={() => setShowAll(v => !v)}
                className="mt-3 text-[10px] font-black px-3 py-1.5 rounded-lg" style={{ background: REV.neutralBg, color: REV.textSoft }}>
                {showAll ? "Show top 8" : `Show all ${sorted.length}`}
              </button>
            )}
          </>
        )}
      </GlassPanel>

      {/* Funnel */}
      <GlassPanel className="xl:col-span-4 p-5">
        <SectionHeader kicker="Pipeline" title="Payment status funnel" accent={REV.violet}
          right={<InfoTip text="Built from real fields only: inquiry rows, booking_confirmed/session_date, deposit payments on the ledger, and outstanding-balance inference. Inquiries with no data for a stage simply don't advance." />} />
        {loading ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-2">
            {funnel.map((stage, i) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold" style={{ color: REV.textSoft }}>{stage.label}</span>
                  <span className="text-xs font-black" style={{ color: stage.color }}>{stage.count}{stage.cents != null ? ` · ${fmtMoney(stage.cents)}` : ""}</span>
                </div>
                <div className="h-5 rounded-md overflow-hidden" style={{ background: REV.inset }}>
                  <div className="h-full rounded-md transition-all duration-500"
                    style={{ width: `${(stage.count / Math.max(funnel[0].count, 1)) * 100}%`, background: `linear-gradient(90deg, ${stage.color}55, ${stage.color}99)`, border: `1px solid ${stage.color}66`, transitionDelay: `${i * 60}ms` }} />
                </div>
              </div>
            ))}
            <p className="text-[10px] font-medium mt-2 leading-relaxed" style={{ color: REV.textFaint }}>
              Stages reflect linked inquiries only; {funnel[0].unlinked} payment payer{funnel[0].unlinked === 1 ? "" : "s"} without an inquiry cannot be staged.
            </p>
          </div>
        )}
      </GlassPanel>

      {open && <ClientDrawer client={open} receivables={receivablesForClient(receivables, open.key)} onClose={() => setOpenClient(null)} />}
    </div>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────────────
type FunnelStage = { label: string; count: number; cents: number | null; color: string; unlinked: number };

function buildFunnel(periodRows: LedgerRow[], inquiries: AdminInquiry[], receivables: Receivable[]): FunnelStage[] {
  const revenue = confirmedRows(periodRows);
  const linkedIds = new Set(revenue.map(p => p.inquiry_id).filter((id): id is number => id != null));
  const unlinked = new Set(revenue.filter(p => p.inquiry_id == null).map(clientKeyOf)).size;

  const booked = inquiries.filter(i => i.booking_confirmed || i.session_date);
  const deposited = inquiries.filter(i => i.deposit_paid_at || linkedIds.has(i.id));
  const outstandingIds = new Set(receivables.map(r => r.inquiryId));
  const fullyPaid = [...linkedIds].filter(id => !outstandingIds.has(id));
  const refunded = new Set(periodRows.filter(p => p.status === "refunded").map(clientKeyOf)).size;

  const mk = (label: string, count: number, cents: number | null, color: string): FunnelStage =>
    ({ label, count, cents, color, unlinked });

  return [
    mk("Inquiries", inquiries.length, null, REV.neutral),
    mk("Booked", booked.length, null, REV.blue),
    mk("Deposit received", deposited.length, null, REV.violet),
    mk("Balance outstanding", receivables.length, receivables.reduce((s, r) => s + r.outstandingCents, 0), REV.amber),
    mk("Fully paid", fullyPaid.length, null, REV.accent),
    mk("Refunded", refunded, null, REV.orange),
  ];
}

// ── Client drawer ───────────────────────────────────────────────────────────
function ClientDrawer({ client, receivables, onClose }: {
  client: ClientAgg; receivables: Receivable[]; onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const outstanding = receivables.reduce((s, r) => s + r.outstandingCents, 0);
  const timeline = [...client.rows].reverse();
  const inquiryIds = [...new Set(client.rows.map(p => p.inquiry_id).filter((id): id is number => id != null))];
  const notes = client.rows.map(p => p.note).filter(Boolean);
  const invoices = client.rows.map(p => p.invoice).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Client details: ${client.name}`}>
      <button type="button" aria-label="Close client details" onClick={onClose}
        className="absolute inset-0 cursor-default" style={{ background: REV.scrim }} />
      <div className="relative w-full max-w-md h-full overflow-y-auto p-5"
        style={{
          background: REV.overlay,
          borderLeft: `1px solid ${REV.panelBorderStrong}`,
          animation: reduced ? undefined : "rev-rise 0.25s cubic-bezier(0.22,1,0.36,1) both",
        }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-black" style={{ color: REV.text }}>{client.name}</h3>
            {client.email && <p className="text-xs font-medium" style={{ color: REV.textSoft }}>{client.email}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-xs font-black px-2.5 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            style={{ background: REV.neutralBg, color: REV.textSoft }}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <GlassPanel className="p-3">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: REV.textFaint }}>Lifetime value (period)</p>
            <p className="text-xl font-black" style={{ color: REV.accent }}>{fmtMoney(client.cents)}</p>
          </GlassPanel>
          <GlassPanel className="p-3">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: REV.textFaint }}>Outstanding (est.)</p>
            <p className="text-xl font-black" style={{ color: outstanding > 0 ? REV.amber : REV.textFaint }}>
              {outstanding > 0 ? `~${fmtMoney(outstanding)}` : "$0"}
            </p>
          </GlassPanel>
        </div>

        {timeline.length > 1 && (
          <div className="mb-4">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: REV.textFaint }}>Revenue timeline</p>
            <Sparkline values={timeline.map(p => p.amount_cents)} width={360} height={40} />
          </div>
        )}

        <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: REV.textFaint }}>
          Payment history · {client.payments} payment{client.payments === 1 ? "" : "s"}
        </p>
        <div className="space-y-2 mb-4">
          {client.rows.map(p => (
            <div key={p.id} className="px-3 py-2 rounded-xl" style={{ background: REV.panel, border: `1px solid ${REV.panelBorder}` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold" style={{ color: REV.textSoft }}>
                  {fmtDate(p.paid_at)} · {p.method || "unknown"} · {p.payment_type.replace("_", " ")}
                </span>
                <span className="text-xs font-black" style={{ color: REV.accent }}>{fmtMoney(p.amount_cents)}</span>
              </div>
              {p.session_date && <p className="text-[10px] font-medium" style={{ color: REV.textFaint }}>session {fmtDate(p.session_date)}</p>}
            </div>
          ))}
        </div>

        {receivables.length > 0 && (
          <>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: REV.amber }}>Open balances</p>
            <div className="space-y-2 mb-4">
              {receivables.map(r => (
                <div key={r.inquiryId} className="px-3 py-2 rounded-xl" style={{ background: REV.amberBg, border: "1px solid rgba(251,191,36,0.25)" }}>
                  <p className="text-[11px] font-bold" style={{ color: REV.text }}>
                    ~{fmtMoney(r.outstandingCents)} of {fmtMoney(r.totalCents)}{r.totalIsEstimate ? " (estimated total)" : ""}
                  </p>
                  <p className="text-[10px] font-medium" style={{ color: REV.textSoft }}>
                    session {fmtDate(r.sessionDate)} · paid {fmtMoney(r.paidCents)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {invoices.length > 0 && (
          <p className="text-[10px] font-medium mb-2" style={{ color: REV.textSoft }}>Invoices: {invoices.join(", ")}</p>
        )}
        {notes.length > 0 && (
          <div className="mb-4">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: REV.textFaint }}>Notes</p>
            {notes.map((n, i) => <p key={i} className="text-[11px] font-medium leading-relaxed" style={{ color: REV.textSoft }}>{n}</p>)}
          </div>
        )}

        {inquiryIds.map(id => (
          <Link key={id} href={`/admin/conversation/${id}`} target="_blank"
            className="inline-block text-[10px] font-black px-3 py-1.5 rounded-lg mr-2 mb-2"
            style={{ background: REV.violetBg, color: REV.violet }}>
            Open inquiry #{id} ↗
          </Link>
        ))}
      </div>
    </div>
  );
}
