"use client";
// Tagging controls above the Portfolio tab's image list: filter chips with
// counts, a "Select to tag" mode, and the bulk bar for the selection. The
// list itself (app/admin/page.tsx) shows each row's badge and filters rows
// with tagging.visible().
import { useMemo } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card } from "@/app/admin/content-engine/[id]/ui";
import type { AuditedPhoto } from "@/lib/photoTagging/types";
import BulkTagBar from "./BulkTagBar";
import PhotoTagToolbar from "./PhotoTagToolbar";
import type { PhotoTagging } from "./usePhotoTagging";

interface Props {
  tagging: PhotoTagging;
  /** Keys of the rows currently shown (after filtering), for "select all". */
  shownKeys: string[];
  selectMode: boolean;
  setSelectMode: (on: boolean) => void;
  onChanged: () => Promise<void>;
}

export default function PortfolioTaggingControls({ tagging, shownKeys, selectMode, setSelectMode, onChanged }: Props) {
  const { report, selected } = tagging;
  const photos = useMemo(() => (report?.photos ?? []).filter((p) => p.source === "portfolio"), [report]);
  const chosen = [...selected].map((k) => tagging.byKey.get(k)).filter((p): p is AuditedPhoto => Boolean(p));
  if (tagging.error) return <p style={{ fontSize: 12, color: T.red }}>Tagging status unavailable: {tagging.error}</p>;
  if (!report) return <p style={{ fontSize: 12, color: T.inkSoft }}>Checking photo tags…</p>;
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
      <div style={{ ...card, marginBottom: 0, display: "grid", gap: 8, padding: 12 }}>
        <PhotoTagToolbar photos={photos} options={report.options} filter={tagging.filter} setFilter={tagging.setFilter} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={{ ...btn(selectMode), padding: "3px 10px", fontSize: 12 }}
            onClick={() => { if (selectMode) tagging.clearSelection(); setSelectMode(!selectMode); }}>
            {selectMode ? "Done tagging" : "Select photos to tag"}
          </button>
          {selectMode && (
            <button type="button" style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }}
              onClick={() => tagging.selectMany(shownKeys)}>Select all {shownKeys.length} shown</button>
          )}
          {selectMode && <span style={{ fontSize: 12, color: T.inkSoft }}>{selected.size} selected — tap photos to add or remove</span>}
        </div>
      </div>
      {selectMode && chosen.length > 0 && (
        <BulkTagBar photos={chosen} options={report.options} onChanged={onChanged} onClear={tagging.clearSelection} />
      )}
    </div>
  );
}
