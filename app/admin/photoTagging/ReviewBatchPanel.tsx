"use client";
// What to do with the review-queue cards selected for batch editing: how many
// cards and photos, one quick approval when every card agrees on the same
// answer ("Review Stanford for 4 photos" — previewed, confirmed, undoable, and
// never overwriting a saved value), and the bulk tag editor for anything else.
// Both write through the queue's shared apply state, so the preview, the
// result and Undo stay visible after the approved cards leave the queue.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn } from "@/app/admin/content-engine/[id]/ui";
import { selectionSummary, sharedSuggestion } from "@/lib/photoTagging/batchSelection";
import type { QueueItem } from "@/lib/photoTagging/reviewQueue";
import type { AuditedPhoto, TaggingOptions } from "@/lib/photoTagging/types";
import BulkTagBar from "./BulkTagBar";
import { TOUCH } from "./ReviewQueueRow";
import type { TagApply } from "./useTagApply";

interface Props {
  items: readonly QueueItem[];
  /** The audited photos behind the selected cards, one per unique key. */
  photos: readonly AuditedPhoto[];
  options: TaggingOptions;
  apply: TagApply;
  onChanged: () => Promise<void> | void;
  onClear: () => void;
}

export default function ReviewBatchPanel({ items, photos, options, apply, onChanged, onClear }: Props) {
  const [editing, setEditing] = useState(false);
  const shared = sharedSuggestion(items);
  const wide = shared.ok && shared.suggestion.appliesTo === "session";
  const quick = () => {
    if (!shared.ok) return;
    void apply.submit({ kind: "changes", keys: shared.keys, changes: shared.changes, replace: false }, "always");
  };
  return (
    <section aria-label="Batch actions for the selected cards"
      style={{ display: "grid", gap: 10, padding: 12, borderRadius: 12, background: T.amberBg, border: `1px solid ${T.amberBorder}` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 14, color: T.ink }} role="status">{selectionSummary(items)}</strong>
        <span style={{ flex: 1 }} />
        <button type="button" style={{ ...btn(false), ...TOUCH }} onClick={onClear}>Clear selection</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {shared.ok ? (
          <button type="button" style={{ ...btn(true), ...TOUCH }} disabled={apply.busy} onClick={quick}
            title={`${shared.suggestion.reason}${wide ? " · sets the whole session" : ""} · fills empty values only · you confirm after a preview`}>
            {shared.label}{wide ? " (session)" : ""}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: T.inkSoft, flex: "1 1 240px" }}>No shared suggestion to approve: {shared.reason}</span>
        )}
        <button type="button" style={{ ...btn(!shared.ok), ...TOUCH }} aria-pressed={editing} onClick={() => setEditing(!editing)}>
          {editing ? "Hide batch editor" : `Batch edit ${photos.length === 1 ? "selected photo" : `${photos.length} selected photos`}`}
        </button>
      </div>
      {shared.ok && (
        <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>
          Every selected card suggests the same answer. The quick action fills empty values only and opens a preview first
          {wide ? " — a university on a Content Engine photo sets its whole session, which the preview spells out." : "."}
        </p>
      )}
      {editing && (
        <BulkTagBar photos={photos} options={options} onChanged={onChanged} onClear={onClear} apply={apply} suggestionTools={false} />
      )}
    </section>
  );
}
