"use client";
// The photo grid's selection toolbar: how many tiles are selected, Tag
// selected (opens the bulk tag editor right here — no scrolling past the
// review queue), Select all, Clear, and Delete. Every control is a 44px
// touch target; nothing here can be reached by a click on a tile.
import { T } from "@/app/admin/adminTheme";
import { selectionLabels } from "@/lib/photoTagging/gridSelection";
import { btn } from "./ui";

interface Props {
  count: number;
  /** How many of the selected photos the tagging audit knows (excluded photos are not audited). */
  taggable: number;
  deleting: boolean;
  onTag: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
}

const SMALL = { padding: "3px 12px", fontSize: 12 } as const;

export default function SelectionBar({ count, taggable, deleting, onTag, onSelectAll, onClear, onDelete }: Props) {
  const labels = selectionLabels(count);
  return (
    <div role="toolbar" aria-label="Selected photos" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{labels.count}</span>
      <button type="button" style={{ ...btn(true), ...SMALL }} disabled={taggable === 0} onClick={onTag}
        title={taggable === 0 ? "Excluded photos are not tagged — include one first" : "Set university, location or campus spot on every selected photo"}>
        {labels.tag}
      </button>
      <button type="button" style={{ ...btn(false), ...SMALL }} onClick={onSelectAll}>Select all</button>
      <button type="button" style={{ ...btn(false), ...SMALL }} onClick={onClear}>Clear</button>
      <button type="button" style={{ ...btn(false, true), ...SMALL }} disabled={deleting} onClick={onDelete}>
        {deleting ? "Deleting…" : labels.remove}
      </button>
    </div>
  );
}
