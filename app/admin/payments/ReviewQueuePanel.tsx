"use client";
// Staged-import review queue: Gmail sync writes to payments_staging; rows
// enter the ledger only via explicit approval here. Also surfaces
// duplicate-suspect groups with keep-both / void actions.

import { useCallback, useEffect, useState } from "react";
import { findDuplicateSuspects, normalizePaymentMethod, type PaymentRow } from "@/lib/paymentFilters";
import { fmtDate, fmtMoney } from "@/lib/revenue/format";
import { GlassPanel } from "./Glass";
import { METHOD_META, REV } from "./palette";

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

  // Dismiss a duplicate-suspect group: both payments are real, mark reconciled.
  async function keepAll(ids: number[]) {
    setError("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, reconciliation_status: "reconciled" }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Update failed");
      onLedgerChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
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
    <GlassPanel className="p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: REV.orange }}>Needs review</p>
          <p className="text-sm font-bold" style={{ color: REV.textSoft }}>
            {staged.length > 0 && `${staged.length} staged import${staged.length === 1 ? "" : "s"}`}
            {staged.length > 0 && duplicateGroups.length > 0 && " · "}
            {duplicateGroups.length > 0 && `${duplicateGroups.length} possible duplicate group${duplicateGroups.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {staged.length > 1 && (
          <button type="button" onClick={() => review("approve", staged.map(s => s.id))} disabled={busyIds.size > 0}
            className="text-[10px] font-black px-3 py-1.5 rounded-lg disabled:opacity-40"
            style={{ background: REV.accentBg, color: REV.accent }}>
            ✓ Approve all {staged.length}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-bold mb-2" style={{ color: REV.red }}>{error}</p>}

      <div className="space-y-3">
        {staged.map(s => {
          const meta = METHOD_META[normalizePaymentMethod(s.method)] ?? METHOD_META.other;
          const busy = busyIds.has(s.id);
          return (
            <div key={s.id} className="px-3.5 py-3 rounded-xl"
              style={{ background: REV.orangeBg, border: "1px solid rgba(251,146,60,0.25)" }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black" style={{ color: REV.text }}>{s.client_name || "Unknown payer"}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md capitalize" style={{ background: REV.neutralBg, color: REV.textSoft }}>
                      {s.payment_type.replace("_", " ")}
                    </span>
                    {!s.inquiry_id && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: REV.orangeBg, color: REV.orange }}>no inquiry</span>
                    )}
                    <span className="text-[10px] font-medium" style={{ color: REV.textFaint }}>{s.source} · {fmtDate(s.paid_at)}</span>
                  </div>
                  {s.client_email && <p className="text-[10px] font-medium mt-0.5" style={{ color: REV.textFaint }}>{s.client_email}</p>}
                  {s.evidence && (
                    <p className="text-[10px] font-medium mt-1.5 px-2.5 py-1.5 rounded-lg line-clamp-3 whitespace-pre-wrap"
                      style={{ background: REV.inset, border: `1px solid ${REV.panelBorder}`, color: REV.textSoft }}>
                      {s.evidence}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-base font-black" style={{ color: REV.orange }}>{fmtMoney(s.amount_cents)}</span>
                  <button type="button" onClick={() => review("approve", [s.id])} disabled={busy}
                    className="text-[10px] font-black px-2.5 py-1 rounded-lg disabled:opacity-40"
                    style={{ background: REV.accentBg, color: REV.accent }}>
                    {busy ? "…" : "✓ approve"}
                  </button>
                  <button type="button" onClick={() => review("reject", [s.id])} disabled={busy}
                    className="text-[10px] font-black px-2.5 py-1 rounded-lg disabled:opacity-40"
                    style={{ background: REV.redBg, color: REV.red }}>
                    ✕ reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {duplicateGroups.map((group, gi) => (
          <div key={`dup-${gi}`} className="px-3.5 py-3 rounded-xl"
            style={{ background: REV.redBg, border: "1px solid rgba(248,113,113,0.25)" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: REV.red }}>
                Possible duplicate — same payer &amp; amount within 3 days
              </p>
              <button type="button" onClick={() => keepAll(group.map(p => p.id))}
                title="Both payments are real — mark reconciled and stop flagging this pair"
                className="text-[10px] font-black px-2.5 py-1 rounded-lg"
                style={{ background: REV.accentBg, color: REV.accent }}>
                ✓ keep both — not duplicates
              </button>
            </div>
            <div className="space-y-1.5">
              {group.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: REV.textSoft }}>
                    {p.client_name} · {fmtMoney(p.amount_cents)} · {fmtDate(p.paid_at)} · {p.method || "unknown"}
                    <span className="font-medium" style={{ color: REV.textFaint }}> ({p.source})</span>
                  </span>
                  <button type="button" onClick={() => voidPayment(p.id)}
                    className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                    style={{ background: REV.redBg, color: REV.red }}>
                    ✕ void this one
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
