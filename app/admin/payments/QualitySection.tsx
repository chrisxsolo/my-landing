"use client";
// Data quality & reconciliation: deterministic anomaly rules over the whole
// ledger, plus the staged-import review queue (Gmail sync → approval). Issues
// are reviewed, dismissed, or voided — never auto-deleted or auto-merged.

import { useState } from "react";
import { fmtMoney, fmtDate } from "@/lib/revenue/format";
import type { LedgerRow } from "@/lib/revenue/enrich";
import { countBySeverity, type QualityIssue } from "@/lib/revenue/quality";
import ReviewQueuePanel from "./ReviewQueuePanel";
import { EmptyState, GlassPanel, InfoTip, SectionHeader } from "./Glass";
import { REV, SEVERITY_META } from "./palette";

type Props = {
  loading: boolean;
  issues: QualityIssue[];
  rowsById: Map<number, LedgerRow>;
  allRows: LedgerRow[];
  stagingReloadToken: number;
  onLedgerChanged: () => void;
};

export default function QualitySection({ loading, issues, rowsById, allRows, stagingReloadToken, onLedgerChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const counts = countBySeverity(issues);

  // Dismiss = mark the involved rows "reconciled" (audited via reconciled_at).
  async function dismiss(issue: QualityIssue) {
    setBusyId(issue.id);
    setError("");
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: issue.paymentIds, reconciliation_status: "reconciled" }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Update failed");
      onLedgerChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Staged imports + duplicate suspects (existing approval workflow) */}
      <ReviewQueuePanel activeRows={allRows} reloadToken={stagingReloadToken} onLedgerChanged={onLedgerChanged} />

      <GlassPanel className="p-5">
        <SectionHeader kicker="Data quality" title="Reconciliation checks" accent={REV.orange}
          right={
            <span className="inline-flex items-center gap-2">
              {(["high", "medium", "low"] as const).map(sev => (
                <span key={sev} className="text-[10px] font-black px-2 py-0.5 rounded-md"
                  style={{ background: SEVERITY_META[sev].bg, color: SEVERITY_META[sev].color }}>
                  {counts[sev]} {sev}
                </span>
              ))}
              <InfoTip text="Deterministic rules over the entire ledger (not affected by dashboard filters): duplicates, unlinked payments, missing dates/platforms, personal-transfer keywords, backfilled imports, balances without retainers. Dismissing marks rows reconciled with an audit timestamp." />
            </span>
          } />
        {error && <p className="text-xs font-bold mb-2" style={{ color: REV.red }}>{error}</p>}
        {loading ? null : issues.length === 0 ? (
          <EmptyState message="Ledger is clean ✓" hint="No rule produced a finding. New imports are re-checked automatically." />
        ) : (
          <div className="space-y-2">
            {issues.map(issue => {
              const sev = SEVERITY_META[issue.severity];
              return (
                <div key={issue.id} className="px-3.5 py-3 rounded-xl"
                  style={{ background: REV.panel, border: `1px solid ${REV.panelBorder}`, borderLeft: `3px solid ${sev.color}` }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                      <p className="text-xs font-black inline-flex items-center gap-2" style={{ color: REV.text }}>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase" style={{ background: sev.bg, color: sev.color }}>
                          {sev.label}
                        </span>
                        {issue.title}
                      </p>
                      <p className="text-[11px] font-medium mt-1 leading-relaxed" style={{ color: REV.textSoft }}>{issue.reason}</p>
                      <div className="mt-1.5 flex gap-2 flex-wrap">
                        {issue.paymentIds.map(id => {
                          const row = rowsById.get(id);
                          return row ? (
                            <span key={id} className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                              style={{ background: REV.inset, color: REV.textSoft }}>
                              #{id} · {row.client_name} · {fmtMoney(row.amount_cents)} · {fmtDate(row.paid_at ?? row.session_date)}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    {issue.dismissible && (
                      <button type="button" onClick={() => dismiss(issue)} disabled={busyId === issue.id}
                        className="text-[10px] font-black px-2.5 py-1.5 rounded-lg disabled:opacity-40 flex-shrink-0"
                        style={{ background: REV.accentBg, color: REV.accent }}
                        title="Reviewed — mark these rows reconciled and stop flagging them">
                        {busyId === issue.id ? "…" : "✓ Reviewed, dismiss"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
