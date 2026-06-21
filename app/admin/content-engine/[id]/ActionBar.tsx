"use client";
// Sticky bottom bar (spec §7.4): "n of m handled · k failed · j approved
// awaiting publish", Approve all remaining (confirmation summary), and
// Publish approved (sequenced one POST per item; per-item failures surface).
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem } from "@/app/admin/content-engine/engineTypes";
import { btn } from "./ui";

interface Props {
  items: EngineItem[];
  marketingPermission: boolean;
  onChanged: () => void;
}

export default function ActionBar({ items, marketingPermission, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const drafts = items.filter((i) => i.status === "draft");
  const approved = items.filter((i) => i.status === "approved");
  const failed = items.filter((i) => i.status === "failed");
  const handled = items.length - drafts.length;
  const publishBlocked = !marketingPermission;
  const publishDisabled = busy !== null || publishBlocked;
  if (items.length === 0) return null;

  const approveAll = async () => {
    const summary = Object.entries(
      drafts.reduce<Record<string, number>>((acc, i) => {
        acc[i.content_type] = (acc[i.content_type] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([t, n]) => `${n} ${CONTENT_TYPE_LABELS[t] ?? t}`).join(", ");
    if (!confirm(`Approve ${drafts.length} item(s)? — ${summary}`)) return;
    setBusy("approve");
    setNotice(null);
    try {
      for (const item of drafts) {
        await engineApi.itemStatus(item.id, "approve");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "approve failed");
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const publishApproved = async () => {
    if (!confirm(`Publish ${approved.length} approved item(s)? Live tables and public storage will be written.`)) return;
    setBusy("publish");
    setNotice(null);
    const problems: string[] = [];
    for (const item of approved) {
      try {
        const result = await engineApi.publish(item.id);
        if (result.revalidationFailures.length > 0) {
          problems.push(`${CONTENT_TYPE_LABELS[item.content_type]}: published; revalidation pending for ${result.revalidationFailures.join(", ")}`);
        }
      } catch (err) {
        const message = err instanceof EngineApiError ? err.message : "publish failed";
        problems.push(`${CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}: ${message}`);
      }
      onChanged();
    }
    if (problems.length > 0) setNotice(problems.join(" · "));
    setBusy(null);
    onChanged();
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
      background: T.panelSolid, borderTop: `1px solid ${T.border}`, padding: "10px 24px",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 13, color: T.inkSoft }}>
        {handled} of {items.length} handled · {failed.length} failed · {approved.length} approved awaiting publish
        {approved.length > 0 && publishBlocked && (
          <span style={{ color: T.amber }}> — enable Marketing permission above to publish</span>
        )}
        {notice && <span style={{ color: T.red }}> — {notice}</span>}
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        {drafts.length > 0 && (
          <button style={btn(false)} disabled={busy !== null} onClick={() => void approveAll()}>
            {busy === "approve" ? "Approving…" : `Approve all remaining (${drafts.length})`}
          </button>
        )}
        {approved.length > 0 && (
          <button
            style={{ ...btn(true), ...(publishDisabled ? { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" } : {}) }}
            disabled={publishDisabled}
            title={publishBlocked ? "Enable marketing permission to publish" : undefined}
            onClick={() => void publishApproved()}>
            {busy === "publish" ? "Publishing…" : `Publish approved (${approved.length})`}
          </button>
        )}
      </span>
    </div>
  );
}
