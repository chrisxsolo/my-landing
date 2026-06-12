"use client";
// §9.4 banner: items stuck publishing past the lease, failed items whose
// target detectably exists (Link to existing — auto for hash/constraint
// proofs, confirm for slug matches), and the orphaned-derivative count.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type ReconcileReport } from "@/app/admin/content-engine/engineTypes";
import { btn, card } from "./ui";

interface Props {
  sessionId: string;
  onChanged: () => void;
}

export default function ReconcileBanner({ sessionId, onChanged }: Props) {
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await engineApi.reconcile(sessionId));
    } catch {
      setReport(null); // banner is best-effort; workspace still works without it
    }
  }, [sessionId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount; banner is best-effort
  useEffect(() => { void load(); }, [load]);

  if (!report) return null;
  const hasWork = report.stuckPublishing.length > 0 || report.failedWithExistingTarget.length > 0;
  if (!hasWork && report.orphanedDerivatives.length === 0) return null;

  const act = async (body: Record<string, unknown>) => {
    setNotice(null);
    try {
      await engineApi.reconcileAction(body);
      await load();
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "action failed");
    }
  };

  return (
    <section style={{ ...card, borderColor: T.red }}>
      <strong style={{ fontSize: 14 }}>Needs reconciliation</strong>
      {notice && <p style={{ color: T.red, fontSize: 13 }}>{notice}</p>}
      {report.stuckPublishing.map((s) => (
        <p key={s.itemId} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          {CONTENT_TYPE_LABELS[s.contentType] ?? s.contentType} stuck publishing since{" "}
          {new Date(s.publishingStartedAt).toLocaleTimeString()}.
          <button style={btn(false, true)} onClick={() => void act({ action: "mark_failed", itemId: s.itemId })}>
            Mark failed
          </button>
        </p>
      ))}
      {report.failedWithExistingTarget.map((m) => (
        <p key={m.itemId} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          Failed {CONTENT_TYPE_LABELS[m.contentType] ?? m.contentType} already exists live ({m.proof}).
          <button style={btn(false)} onClick={() => {
            if (m.autoConfirmable || confirm("Slug matches are not proof of provenance. Link anyway?")) {
              void act({ action: "link", itemId: m.itemId, targetType: m.targetType, targetId: m.targetId, confirm: !m.autoConfirmable });
            }
          }}>
            Link to existing record
          </button>
        </p>
      ))}
      {report.orphanedDerivatives.length > 0 && (
        <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 0 }}>
          {report.orphanedDerivatives.length} orphaned public derivative(s) — reclaimed by the deferred cleanup sweep.
        </p>
      )}
    </section>
  );
}
