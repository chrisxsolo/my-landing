"use client";
// Sticky bottom bar (spec §7.4): "n of m handled · k failed · j approved
// awaiting publish", Approve all remaining (confirmation summary), and
// Publish approved (sequenced one POST per item; per-item failures surface).
// Scheduled items are left to their schedule: bulk publish skips them and
// says how many it skipped; publishing one early is its own Publish now.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import { CONTENT_TYPE_LABELS, type EngineItem, type PublicationScheduleDto } from "@/app/admin/content-engine/engineTypes";
import { btn } from "./ui";

interface Props {
  items: EngineItem[];
  schedules?: PublicationScheduleDto[];
  marketingPermission: boolean;
  onChanged: () => void;
}

/** Approved items the bulk action publishes: those WITHOUT an active schedule. Pure; tested. */
export function publishableNow(items: EngineItem[], schedules: PublicationScheduleDto[]): { now: EngineItem[]; scheduled: EngineItem[] } {
  const active = new Set(schedules.filter((s) => s.state !== "cancelled" && s.state !== "published").map((s) => s.content_item_id));
  const approved = items.filter((i) => i.status === "approved");
  return { now: approved.filter((i) => !active.has(i.id)), scheduled: approved.filter((i) => active.has(i.id)) };
}

export default function ActionBar({ items, schedules = [], marketingPermission, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const drafts = items.filter((i) => i.status === "draft");
  const { now: approved, scheduled } = publishableNow(items, schedules);
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
    const skipped = scheduled.length ? ` ${scheduled.length} scheduled item(s) are left to their schedule.` : "";
    if (!confirm(`Publish ${approved.length} approved item(s) now? Live tables and public storage will be written.${skipped}`)) return;
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
    // Block reasons can span lines (which place, the excerpt, how to fix it).
    if (problems.length > 0) setNotice(problems.join("\n\n"));
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
        {scheduled.length > 0 && ` · ${scheduled.length} scheduled`}
        {approved.length > 0 && publishBlocked && (
          <span style={{ color: T.amber }}> — enable Marketing permission above to publish</span>
        )}
        {notice && (
          <span role="alert" style={{
            display: "block", marginTop: 4, color: T.red, whiteSpace: "pre-line",
            maxHeight: "40vh", overflowY: "auto",
          }}>{notice}</span>
        )}
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
