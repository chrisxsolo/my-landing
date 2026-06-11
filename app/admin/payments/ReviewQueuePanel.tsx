"use client";
import { useCallback, useEffect, useState } from "react";
import { findDuplicateSuspects, type PaymentRow } from "@/lib/paymentFilters";
import { METHOD_META, fmtMoney } from "./TransactionsPanel";
import { normalizePaymentMethod } from "@/lib/paymentFilters";

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

type StagedPayment = {
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
  source_txn_id: string;
  paid_at: string;
  session_date: string | null;
  evidence: string;
};

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  activeRows: PaymentRow[]; // ledger rows for duplicate detection
  reloadToken: number; // bump to refetch staged rows (e.g. after a sync)
  onLedgerChanged: () => void; // parent reloads payments after approvals/voids
};

export default function ReviewQueuePanel({ activeRows, reloadToken, onLedgerChanged }: Props) {
  const [staged, setStaged] = useState<StagedPayment[]>([]);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const loadStaged = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payment-staging");
      const json = await res.json() as { staged?: StagedPayment[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load review queue");
      setStaged(json.staged ?? []);
    } catch (err) {
      console.error("[ReviewQueuePanel] load failed:", err);
    }
  }, []);

  useEffect(() => { loadStaged(); }, [loadStaged, reloadToken]);

  async function review(action: "approve" | "reject", ids: number[]) {
    setBusyIds(prev => new Set([...prev, ...ids]));
    setError("");
    try {
      const res = await fetch("/api/admin/payment-staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Review failed");
      await loadStaged();
      if (action === "approve") onLedgerChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusyIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }

  async function voidPayment(paymentId: number) {
    try {
      const res = await fetch("/api/void-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, action: "void" }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Void failed");
      onLedgerChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Void failed");
    }
  }

  const duplicateGroups = findDuplicateSuspects(activeRows);
  if (!staged.length && !duplicateGroups.length) return null;

  return (
    <div className={card}>
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)" }} />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "#f97316" }}>Needs Review</p>
            <p className="text-sm text-slate-400 font-medium">
              {staged.length > 0 && `${staged.length} staged import${staged.length === 1 ? "" : "s"}`}
              {staged.length > 0 && duplicateGroups.length > 0 && " · "}
              {duplicateGroups.length > 0 && `${duplicateGroups.length} possible duplicate group${duplicateGroups.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {staged.length > 1 && (
            <button onClick={() => review("approve", staged.map(s => s.id))}
              disabled={busyIds.size > 0}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
              ✓ Approve all {staged.length}
            </button>
          )}
        </div>
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}

        {staged.map(s => {
          const meta = METHOD_META[normalizePaymentMethod(s.method)] ?? METHOD_META.other;
          const busy = busyIds.has(s.id);
          return (
            <div key={s.id} className="px-4 py-3 rounded-xl"
              style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.15)" }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-900">{s.client_name || "Unknown payer"}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(148,163,184,0.1)", color: "#64748b" }}>
                      {s.payment_type.replace("_", " ")}
                    </span>
                    {!s.inquiry_id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>no inquiry</span>
                    )}
                    <span className="text-[10px] text-slate-400">{s.source} · {fmtDate(s.paid_at)}</span>
                  </div>
                  {s.client_email && <p className="text-[10px] text-slate-400 mt-0.5">{s.client_email}</p>}
                  {s.evidence && (
                    <p className="text-[10px] text-slate-500 mt-1.5 px-2 py-1.5 rounded-lg bg-white border border-slate-100 line-clamp-3 whitespace-pre-wrap">
                      {s.evidence}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-base font-black" style={{ color: "#f97316" }}>{fmtMoney(s.amount_cents)}</span>
                  <button onClick={() => review("approve", [s.id])} disabled={busy}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
                    style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                    {busy ? "…" : "✓ approve"}
                  </button>
                  <button onClick={() => review("reject", [s.id])} disabled={busy}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                    ✕ reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {duplicateGroups.map((group, gi) => (
          <div key={`dup-${gi}`} className="px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#ef4444" }}>
              Possible duplicate — same payer &amp; amount within 3 days
            </p>
            <div className="space-y-1.5">
              {group.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">
                    {p.client_name} · {fmtMoney(p.amount_cents)} · {fmtDate(p.paid_at)} · {p.method || "unknown"}
                    <span className="text-slate-400 font-medium"> ({p.source})</span>
                  </span>
                  <button onClick={() => voidPayment(p.id)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                    ✕ void this one
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
