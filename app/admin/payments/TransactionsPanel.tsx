"use client";
import { useState } from "react";
import Link from "next/link";
import {
  applyPaymentFilters,
  normalizePaymentMethod,
  paymentsToCsv,
  type PaymentFilterState,
  type PaymentRow,
  type PaymentSortKey,
} from "@/lib/paymentFilters";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

export const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  Venmo:      { label: "Venmo",    color: "#3D95CE", bg: "rgba(61,149,206,0.1)"  },
  Zelle:      { label: "Zelle",    color: "#6D1ED4", bg: "rgba(109,30,212,0.1)"  },
  PayPal:     { label: "PayPal",   color: "#0070BA", bg: "rgba(0,112,186,0.1)"   },
  "Cash App": { label: "Cash App", color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  Pixieset:   { label: "Pixieset", color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  other:      { label: "Other",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

export function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const RECON_META: Record<string, { label: string; color: string; bg: string }> = {
  unreviewed:   { label: "unreviewed",   color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  needs_review: { label: "needs review", color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
  confirmed:    { label: "confirmed",    color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  reconciled:   { label: "reconciled",   color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
};

const SORT_OPTIONS: { key: PaymentSortKey; label: string }[] = [
  { key: "date",     label: "Date" },
  { key: "amount",   label: "Amount" },
  { key: "client",   label: "Client" },
  { key: "imported", label: "Imported" },
];

// Confirm popover for void/refund
function ActionMenu({ payment, onDone }: { payment: PaymentRow; onDone: () => void }) {
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

  if (step !== "idle") {
    const isVoid = step === "confirm-void";
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">{isVoid ? "Remove this payment?" : "Mark as refunded?"}</span>
        <button onClick={() => submit(isVoid ? "void" : "refund")} disabled={busy}
          className="text-xs font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
          style={isVoid
            ? { background: "rgba(239,68,68,0.1)", color: "#ef4444" }
            : { background: "rgba(245,158,11,0.1)", color: "#d97706" }}>
          {busy ? "…" : isVoid ? "Yes, remove" : "Yes, refunded"}
        </button>
        <button onClick={() => setStep("idle")} disabled={busy}
          className="text-xs text-slate-400 hover:text-slate-600">cancel</button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    );
  }

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

function DetailGrid({ p }: { p: PaymentRow }) {
  const fields: [string, string][] = [
    ["Paid", fmtDate(p.paid_at)],
    ["Posted", fmtDate(p.posted_at ?? null)],
    ["Imported", fmtDate(p.imported_at)],
    ["Session date", fmtDate(p.session_date)],
    ["Source", p.source || "—"],
    ["Source txn id", p.source_txn_id || "—"],
    ["Invoice", p.invoice || "—"],
    ["Service", p.inquiry_session_type ?? "unlinked"],
    ["Fee", p.fee_cents ? fmtMoney(p.fee_cents) : "—"],
    ["Refund", p.refund_cents ? fmtMoney(p.refund_cents) : "—"],
  ];
  return (
    <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1.5">
      {fields.map(([label, value]) => (
        <div key={label}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">{label}</p>
          <p className="text-[11px] font-bold text-slate-600 break-all">{value}</p>
        </div>
      ))}
      {p.note && (
        <div className="col-span-2 md:col-span-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Note</p>
          <p className="text-[11px] text-slate-600">{p.note}</p>
        </div>
      )}
    </div>
  );
}

type Props = {
  rows: PaymentRow[]; // already scoped to the selected period by the parent
  loading: boolean;
  filters: PaymentFilterState;
  onFiltersChange: (f: PaymentFilterState) => void;
  periodLabel: string;
  onReload: () => void;
};

export default function TransactionsPanel({ rows, loading, filters, onFiltersChange, periodLabel, onReload }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const visible = applyPaymentFilters(rows, filters);
  const set = (patch: Partial<PaymentFilterState>) => onFiltersChange({ ...filters, ...patch });

  function exportCsv() {
    const blob = new Blob([paymentsToCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${periodLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const centsInput = (value: number | null, onChange: (v: number | null) => void, placeholder: string) => (
    <input type="number" min={0} placeholder={placeholder}
      value={value === null ? "" : value / 100}
      onChange={e => onChange(e.target.value === "" ? null : Math.round(parseFloat(e.target.value) * 100))}
      className="w-20 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-300" />
  );

  const select = (value: string, onChange: (v: string) => void, options: [string, string][]) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className={card}>
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#059669)" }} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#10b981" }}>Transactions</p>
            <p className="text-sm text-slate-400 font-medium">
              {visible.length} shown · {fmtMoney(visible.reduce((s, p) => s + p.amount_cents, 0))} · {periodLabel}
            </p>
          </div>
          <button onClick={exportCsv} disabled={!visible.length}
            className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ background: "rgba(16,185,129,0.08)", color: "#10b981" }}>
            ⬇ Export CSV ({visible.length})
          </button>
        </div>

        {/* Filter / sort controls */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <input type="search" placeholder="Search client, email, invoice, note…"
            value={filters.search} onChange={e => set({ search: e.target.value })}
            className="flex-1 min-w-[180px] text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-300" />
          {select(filters.status, v => set({ status: v }), [["active", "Active"], ["refunded", "Refunded"], ["voided", "Voided"], ["", "All statuses"]])}
          {select(filters.method, v => set({ method: v }), [["", "All methods"], ...Object.keys(METHOD_META).map(m => [m, METHOD_META[m].label] as [string, string])])}
          {select(filters.paymentType, v => set({ paymentType: v }), [["", "All types"], ["deposit_1", "Deposit 1"], ["deposit_2", "Deposit 2"], ["full", "Full"], ["other", "Other"]])}
          {select(filters.recon, v => set({ recon: v }), [["", "All recon"], ["confirmed", "Confirmed"], ["needs_review", "Needs review"], ["unreviewed", "Unreviewed"], ["reconciled", "Reconciled"]])}
          {centsInput(filters.minCents, v => set({ minCents: v }), "$ min")}
          {centsInput(filters.maxCents, v => set({ maxCents: v }), "$ max")}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-50 border border-slate-100">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button key={key}
                onClick={() => set(filters.sortKey === key
                  ? { sortDir: filters.sortDir === "asc" ? "desc" : "asc" }
                  : { sortKey: key, sortDir: "desc" })}
                className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
                style={filters.sortKey === key ? { background: "rgba(16,185,129,0.12)", color: "#10b981" } : { color: "#94a3b8" }}>
                {label}{filters.sortKey === key ? (filters.sortDir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">💳</p>
            <p className="text-sm text-slate-400">No payments match these filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((p, i) => {
              const meta = METHOD_META[normalizePaymentMethod(p.method)] ?? METHOD_META.other;
              const recon = RECON_META[p.reconciliation_status] ?? RECON_META.unreviewed;
              const isVoided = p.status === "voided";
              const isRefunded = p.status === "refunded";
              const isOpen = expanded === p.id;
              return (
                <div key={p.id}
                  className="px-4 py-3 rounded-xl transition-all hover:shadow-sm cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  style={{
                    background: isVoided ? "rgba(239,68,68,0.03)" : isRefunded ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? "rgba(248,250,252,0.8)" : "white",
                    border: isVoided ? "1px solid rgba(239,68,68,0.12)" : isRefunded ? "1px solid rgba(245,158,11,0.15)" : "1px solid rgba(148,163,184,0.08)",
                    opacity: isVoided ? 0.6 : 1,
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.label.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                        <Link href={p.inquiry_id ? `/admin/conversation/${p.inquiry_id}` : `/admin?tab=clients&client=${encodeURIComponent(p.client_email || p.client_name)}`}
                          className={`text-sm font-black text-slate-900 hover:underline ${isVoided ? "line-through" : ""}`}
                          title={p.inquiry_id ? "Open client card and email thread" : "Find this client in Clients"}>
                          {p.client_name}
                        </Link>
                        {!p.inquiry_id && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>no inquiry</span>
                        )}
                        {isVoided && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>voided</span>
                        )}
                        {isRefunded && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", color: "#d97706" }}>refunded</span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(148,163,184,0.1)", color: "#64748b" }}>
                          {p.payment_type?.replace("_", " ")}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: recon.bg, color: recon.color }}>
                          {recon.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {p.client_email && <span className="text-[10px] text-slate-400">{p.client_email}</span>}
                        <span className="text-[10px] text-slate-400">{fmtDate(p.paid_at ?? p.session_date)}</span>
                        {p.inquiry_session_type && <span className="text-[10px] text-slate-400 capitalize">{p.inquiry_session_type}</span>}
                      </div>
                      {p.status === "active" && (
                        <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                          <ActionMenu payment={p} onDone={onReload} />
                        </div>
                      )}
                      {isOpen && <DetailGrid p={p} />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-base font-black"
                        style={{ color: isVoided ? "#94a3b8" : isRefunded ? "#d97706" : p.amount_cents > 0 ? "#10b981" : "#94a3b8" }}>
                        {isRefunded ? `(${fmtMoney(p.amount_cents)})` : p.amount_cents > 0 ? fmtMoney(p.amount_cents) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
