"use client";
// The durable change history (photo_change_log): who changed which field,
// from what to what, newest first. Restore puts a field back to its old
// value through the normal apply path, so it is itself a new "manual" entry
// — history is never rewritten. Session link changes made by the location
// sync are listed too, but only tag fields can be restored from here.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, chip } from "@/app/admin/content-engine/[id]/ui";
import { isRestorable, LIBRARY_LINKS_FIELD, type ChangeActor, type ChangeLogRow } from "@/lib/photoChangeLog/entries";
import type { TaggingOptions, TagField } from "@/lib/photoTagging/types";
import { applySummary, taggingApi } from "./taggingApi";
import { valueLabel } from "./TagApplyPanel";

const ACTOR: Record<ChangeActor, { label: string; color: string; bg: string }> = {
  manual: { label: "You", color: T.green, bg: T.greenBg },
  system: { label: "Automatic", color: T.blue, bg: T.blueBg },
  ai: { label: "AI", color: T.violet, bg: T.violetBg },
};
const FIELD_LABEL: Record<string, string> = {
  category: "Category", school: "University", location: "Location", spot: "Campus spot", [LIBRARY_LINKS_FIELD]: "Library links",
};
const TOUCH = { minHeight: 44, padding: "8px 14px", fontSize: 13 } as const;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A logged value as a person reads it; link lists show their count. */
function shown(row: ChangeLogRow, value: unknown, options: TaggingOptions): string {
  if (row.field === LIBRARY_LINKS_FIELD) {
    const ids = (value as { locationIds?: number[] } | null)?.locationIds ?? [];
    return ids.length === 0 ? "no locations" : `${ids.length} location${ids.length === 1 ? "" : "s"} (#${ids.join(", #")})`;
  }
  return value === null || typeof value === "string" ? valueLabel(row.field as TagField, value, options) : JSON.stringify(value);
}

interface Props {
  options: TaggingOptions;
  /** Limits the list to one photo's (or "session:<uuid>") history. */
  photoKey?: string;
  titleOf: (key: string) => string;
  onChanged: () => Promise<void> | void;
}

function HistoryRow({ row, options, titleOf, busy, onRestore }: {
  row: ChangeLogRow; options: TaggingOptions; titleOf: (key: string) => string; busy: boolean; onRestore: () => void;
}) {
  const actor = ACTOR[row.actor];
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderRadius: 10,
      background: T.inset, border: `1px solid ${T.border}` }}>
      <span style={chip(actor.color, actor.bg)}>{actor.label}</span>
      <span style={{ fontSize: 12, color: T.inkSoft, flex: "1 1 240px", minWidth: 0 }}>
        <strong style={{ color: T.ink }}>{titleOf(row.key)}</strong> · {FIELD_LABEL[row.field] ?? row.field}:{" "}
        <span style={{ color: T.inkFaint }}>{shown(row, row.oldValue, options)}</span>
        {" → "}<strong style={{ color: T.ink }}>{shown(row, row.newValue, options)}</strong>
        {row.reason ? <span style={{ color: T.inkFaint }}> · {row.reason}</span> : null}
      </span>
      <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.mono }}>{when(row.createdAt)}</span>
      {isRestorable(row) && (
        <button type="button" style={{ ...btn(false), ...TOUCH }} disabled={busy} onClick={onRestore}
          title="Writes the old value back as a new change">Restore</button>
      )}
    </li>
  );
}

export default function ChangeHistory({ options, photoKey, titleOf, onChanged }: Props) {
  const [rows, setRows] = useState<ChangeLogRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await taggingApi.history(photoKey)).changes);
    } catch (err) {
      console.error("[photo-tagging] history failed", err);
      setNotice({ text: err instanceof Error ? err.message : "could not load the history", ok: false });
    }
  }, [photoKey]);
  useEffect(() => { void load(); }, [load]);

  const restore = async (row: ChangeLogRow) => {
    setBusy(true);
    setNotice(null);
    try {
      const summary = applySummary(await taggingApi.restore(row.id));
      setNotice({ text: `Restored · ${summary.text}`, ok: summary.ok });
      await onChanged();
      await load();
    } catch (err) {
      console.error("[photo-tagging] restore failed", err);
      setNotice({ text: err instanceof Error ? err.message : "restore failed", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 6 }} aria-label="Change history">
      {notice && <p role="status" style={{ margin: 0, fontSize: 13, color: notice.ok ? T.green : T.red }}>{notice.text}</p>}
      {rows === null ? <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>Loading history…</p>
        : rows.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>No recorded changes yet.</p>
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {rows.map((row) => (
              <HistoryRow key={row.id} row={row} options={options} titleOf={titleOf} busy={busy} onRestore={() => void restore(row)} />
            ))}
          </ul>
        )}
    </div>
  );
}
