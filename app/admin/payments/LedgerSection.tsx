"use client";
// Transaction ledger: every row behind the headline numbers, with sorting,
// ledger-local filters, expandable detail, data-quality indicators, CSV
// export and the void/refund actions (ported from the previous panel).

import { useMemo, useState } from "react";
import Link from "next/link";
import { normalizePaymentMethod, paymentsToCsv, type PaymentSortKey } from "@/lib/paymentFilters";
import { fmtDate, fmtMoney } from "@/lib/revenue/format";
import type { LedgerRow } from "@/lib/revenue/enrich";
import { SERVICE_LABELS } from "@/lib/revenue/enrich";
import { schoolLabel } from "@/lib/revenue/schools";
import type { QualityIssue } from "@/lib/revenue/quality";
import { EmptyState, GlassPanel, SectionHeader, Skeleton } from "./Glass";
import { METHOD_META, REV, SEVERITY_META } from "./palette";

const PAGE_SIZE = 25;

const RECON_META: Record<string, { label: string; color: string; bg: string }> = {
  unreviewed: { label: "unreviewed", color: REV.neutral, bg: REV.neutralBg },
  needs_review: { label: "needs review", color: REV.orange, bg: REV.orangeBg },
  confirmed: { label: "confirmed", color: REV.accent, bg: REV.accentBg },
  reconciled: { label: "reconciled", color: REV.violet, bg: REV.violetBg },
};

type Props = {
  loading: boolean;
  rows: LedgerRow[]; // already scoped by global filters + period
  periodLabel: string;
  issues: QualityIssue[];
  onReload: () => void;
};

export default function LedgerSection({ loading, rows, periodLabel, issues, onReload }: Props) {
  const [sortKey, setSortKey] = useState<PaymentSortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [paymentType, setPaymentType] = useState("");
  const [recon, setRecon] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<number | null>(null);

  const issuesByPayment = useMemo(() => {
    const map = new Map<number, QualityIssue[]>();
    for (const issue of issues) {
      for (const id of issue.paymentIds) {
        const list = map.get(id);
        if (list) list.push(issue);
        else map.set(id, [issue]);
      }
    }
    return map;
  }, [issues]);

  const visible = useMemo(() => {
    const filtered = rows.filter(r =>
      (!paymentType || r.payment_type === paymentType) && (!recon || r.reconciliation_status === recon));
    const dir = sortDir === "asc" ? 1 : -1;
    const valueOf = (r: LedgerRow): string | number =>
      sortKey === "amount" ? r.amount_cents
        : sortKey === "client" ? r.client_name.toLowerCase()
          : sortKey === "imported" ? r.imported_at ?? ""
            : r.paid_at ?? "";
    return [...filtered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [rows, paymentType, recon, sortKey, sortDir]);

  const shown = visible.slice(0, limit);
  const totalCents = visible.filter(r => r.status === "active").reduce((s, r) => s + r.amount_cents, 0);

  function exportCsv() {
    const blob = new Blob([paymentsToCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${periodLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const select = (label: string, value: string, onSel: (v: string) => void, options: [string, string][]) => (
    <select aria-label={label} value={value} onChange={e => onSel(e.target.value)}
      className="text-[10px] font-bold px-2 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      style={{ background: REV.inset, border: `1px solid ${REV.panelBorder}`, color: REV.textSoft }}>
      {options.map(([v, l]) => <option key={v} value={v} style={{ background: "#0c1626" }}>{l}</option>)}
    </select>
  );

  const sortBtn = (key: PaymentSortKey, label: string) => (
    <button key={key} type="button"
      onClick={() => (sortKey === key ? setSortDir(d => (d === "asc" ? "desc" : "asc")) : (setSortKey(key), setSortDir("desc")))}
      className="px-2 py-1 rounded-md text-[10px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      style={sortKey === key ? { background: REV.accentBg, color: REV.accent } : { color: REV.textSoft }}
      aria-pressed={sortKey === key}>
      {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <GlassPanel className="p-5">
      <SectionHeader kicker="Transaction ledger" title={`${visible.length} transactions · ${fmtMoney(totalCents)} active`}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            {select("Payment type", paymentType, setPaymentType,
              [["", "All types"], ["deposit_1", "Retainer"], ["deposit_2", "Balance"], ["full", "Full"], ["other", "Other"]])}
            {select("Reconciliation status", recon, setRecon,
              [["", "All recon"], ["confirmed", "Confirmed"], ["needs_review", "Needs review"], ["unreviewed", "Unreviewed"], ["reconciled", "Reconciled"]])}
            <div className="flex gap-0.5 p-0.5 rounded-lg" role="group" aria-label="Sort"
              style={{ background: REV.inset, border: `1px solid ${REV.panelBorder}` }}>
              {sortBtn("date", "Date")}{sortBtn("amount", "Amount")}{sortBtn("client", "Client")}{sortBtn("imported", "Imported")}
            </div>
            <button type="button" onClick={exportCsv} disabled={!visible.length}
              className="text-[10px] font-black px-2.5 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: REV.accentBg, color: REV.accent }}>
              ⬇ CSV
            </button>
          </div>
        } />

      {loading ? <Skeleton className="h-48 w-full" /> : shown.length === 0 ? (
        <EmptyState message="No payments match these filters." hint="Try resetting the filters in the control bar above." />
      ) : (
        <div className="space-y-1.5">
          {shown.map(p => {
            const meta = METHOD_META[normalizePaymentMethod(p.method)] ?? METHOD_META.other;
            const reconMeta = RECON_META[p.reconciliation_status] ?? RECON_META.unreviewed;
            const rowIssues = issuesByPayment.get(p.id) ?? [];
            const worst = rowIssues.find(i => i.severity === "high") ?? rowIssues[0];
            const isVoided = p.status === "voided";
            const isRefunded = p.status === "refunded";
            const isOpen = expanded === p.id;
            return (
              <div key={p.id} className="px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors"
                onClick={() => setExpanded(isOpen ? null : p.id)}
                style={{
                  background: isVoided ? "rgba(248,113,113,0.05)" : isRefunded ? "rgba(251,146,60,0.06)" : REV.panel,
                  border: `1px solid ${isVoided ? "rgba(248,113,113,0.18)" : isRefunded ? "rgba(251,146,60,0.2)" : REV.panelBorder}`,
                  opacity: isVoided ? 0.55 : 1,
                }}>
                <div className="flex items-start gap-3">
                  <div aria-hidden className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                    style={{ background: meta.bg, color: meta.color }}>
                    {meta.label.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                      <Link href={p.inquiry_id ? `/admin/conversation/${p.inquiry_id}` : `/admin?tab=clients&client=${encodeURIComponent(p.client_email || p.client_name)}`}
                        className={`text-xs font-black hover:underline ${isVoided ? "line-through" : ""}`} style={{ color: REV.text }}>
                        {p.client_name}
                      </Link>
                      <Badge bg={REV.neutralBg} color={REV.textSoft}>{p.payment_type.replace("_", " ")}</Badge>
                      <Badge bg={reconMeta.bg} color={reconMeta.color}>{reconMeta.label}</Badge>
                      {isVoided && <Badge bg={REV.redBg} color={REV.red}>voided</Badge>}
                      {isRefunded && <Badge bg={REV.orangeBg} color={REV.orange}>refunded</Badge>}
                      {worst && (
                        <Badge bg={SEVERITY_META[worst.severity].bg} color={SEVERITY_META[worst.severity].color}>
                          <span title={worst.reason}>⚠ {worst.rule}</span>
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] font-medium mt-0.5 truncate" style={{ color: REV.textFaint }}>
                      {fmtDate(p.paid_at ?? p.session_date)}
                      {p.serviceKey !== "unlinked" && ` · ${SERVICE_LABELS[p.serviceKey]}`}
                      {p.schoolKey !== "unlinked" && p.schoolKey !== "other" && ` · ${schoolLabel(p.schoolKey)}`}
                      {p.client_email && ` · ${p.client_email}`}
                    </p>
                    {p.status === "active" && (
                      <div className="mt-1" onClick={e => e.stopPropagation()}>
                        <RowActions paymentId={p.id} onDone={onReload} />
                      </div>
                    )}
                    {isOpen && <DetailGrid p={p} issues={rowIssues} />}
                  </div>
                  <span className="text-sm font-black flex-shrink-0 mt-0.5"
                    style={{ color: isVoided ? REV.textFaint : isRefunded ? REV.orange : REV.accent }}>
                    {isRefunded ? `(${fmtMoney(p.amount_cents)})` : fmtMoney(p.amount_cents)}
                  </span>
                </div>
              </div>
            );
          })}
          {visible.length > limit && (
            <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)}
              className="w-full text-[10px] font-black py-2 rounded-xl mt-1"
              style={{ background: REV.neutralBg, color: REV.textSoft }}>
              Show {Math.min(PAGE_SIZE, visible.length - limit)} more of {visible.length - limit} remaining
            </button>
          )}
        </div>
      )}
    </GlassPanel>
  );
}

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md capitalize whitespace-nowrap" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

function DetailGrid({ p, issues }: { p: LedgerRow; issues: QualityIssue[] }) {
  const fields: [string, string][] = [
    ["Paid", fmtDate(p.paid_at)],
    ["Posted", fmtDate(p.posted_at ?? null)],
    ["Imported", fmtDate(p.imported_at)],
    ["Session date", fmtDate(p.session_date)],
    ["Source", p.source || "—"],
    ["Source txn id", p.source_txn_id || "—"],
    ["Invoice", p.invoice || "—"],
    ["Linked inquiry", p.inquiry_id ? `#${p.inquiry_id}` : "none"],
    ["Fee", p.fee_cents ? fmtMoney(p.fee_cents) : "—"],
    ["Refund", p.refund_cents ? fmtMoney(p.refund_cents) : "—"],
  ];
  return (
    <div className="mt-2 pt-2 grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1.5" style={{ borderTop: `1px solid ${REV.panelBorder}` }}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: REV.textFaint }}>{label}</p>
          <p className="text-[10px] font-bold break-all" style={{ color: REV.textSoft }}>{value}</p>
        </div>
      ))}
      {p.note && (
        <div className="col-span-2 md:col-span-5">
          <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: REV.textFaint }}>Note</p>
          <p className="text-[10px] font-medium" style={{ color: REV.textSoft }}>{p.note}</p>
        </div>
      )}
      {issues.map(i => (
        <div key={i.id} className="col-span-2 md:col-span-5 px-2 py-1.5 rounded-lg" style={{ background: SEVERITY_META[i.severity].bg }}>
          <p className="text-[10px] font-black" style={{ color: SEVERITY_META[i.severity].color }}>{i.title}</p>
          <p className="text-[10px] font-medium" style={{ color: REV.textSoft }}>{i.reason}</p>
        </div>
      ))}
    </div>
  );
}

// Void / refund with inline confirm (financial actions stay two-step).
function RowActions({ paymentId, onDone }: { paymentId: number; onDone: () => void }) {
  const [step, setStep] = useState<"idle" | "void" | "refund">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(action: "void" | "refund") {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/void-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, action }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok) { setErr(json.error ?? "Failed"); setBusy(false); return; }
      onDone();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  if (step !== "idle") {
    const isVoid = step === "void";
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold" style={{ color: REV.textSoft }}>{isVoid ? "Remove this payment?" : "Mark as refunded?"}</span>
        <button type="button" onClick={() => submit(step)} disabled={busy}
          className="text-[10px] font-black px-2 py-0.5 rounded-md disabled:opacity-40"
          style={isVoid ? { background: REV.redBg, color: REV.red } : { background: REV.orangeBg, color: REV.orange }}>
          {busy ? "…" : isVoid ? "Yes, remove" : "Yes, refunded"}
        </button>
        <button type="button" onClick={() => setStep("idle")} disabled={busy}
          className="text-[10px] font-bold" style={{ color: REV.textFaint }}>cancel</button>
        {err && <span className="text-[10px] font-bold" style={{ color: REV.red }}>{err}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={() => setStep("void")} title="Remove — recorded in error, disappears from analytics"
        className="text-[9px] font-black px-1.5 py-0.5 rounded-md hover:opacity-80" style={{ background: REV.redBg, color: REV.red }}>
        ✕ void
      </button>
      <button type="button" onClick={() => setStep("refund")} title="Refund — money returned to the client"
        className="text-[9px] font-black px-1.5 py-0.5 rounded-md hover:opacity-80" style={{ background: REV.orangeBg, color: REV.orange }}>
        ↩ refund
      </button>
    </span>
  );
}
