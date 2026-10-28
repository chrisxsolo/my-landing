"use client";
// The bulk tag editor as a modal, opened from "Tag N selected" in a photo
// grid's selection toolbar — so tagging the selected photos never means
// scrolling past the review queue to find the editor. Reuses BulkTagBar as
// is (TagFields, Replace, preview → confirm → apply, Undo); the owner's shared
// apply state keeps the result and Undo on the page once the dialog closes.
// Click the backdrop or press Escape to close, keeping the selection.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { overlay } from "@/app/admin/content-engine/[id]/ui";
import type { AuditedPhoto, TaggingOptions } from "@/lib/photoTagging/types";
import BulkTagBar from "./BulkTagBar";
import TagApplyPanel from "./TagApplyPanel";
import type { TagApply } from "./useTagApply";

interface Props {
  photos: readonly AuditedPhoto[];
  options: TaggingOptions;
  apply: TagApply;
  onChanged: () => Promise<void> | void;
  /** Closes the dialog; the selection stays. */
  onClose: () => void;
  /** Clears the selection (and so closes the dialog). */
  onClearSelection: () => void;
}

export default function BulkTagDialog({ photos, options, apply, onChanged, onClose, onClearSelection }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const titleOf = (key: string) => photos.find((p) => p.key === key)?.title ?? key;
  return createPortal(
    <div style={{ ...overlay, alignItems: "flex-start", overflowY: "auto", padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Tag ${photos.length} selected photo${photos.length === 1 ? "" : "s"}`}
        style={{ width: "100%", maxWidth: 820, margin: "16px auto", display: "grid", gap: 10 }}>
        <BulkTagBar photos={photos} options={options} onChanged={onChanged} onClear={onClearSelection} onClose={onClose} apply={apply} />
        <TagApplyPanel apply={apply} options={options} titleOf={titleOf} />
      </div>
    </div>,
    document.body,
  );
}
