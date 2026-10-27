"use client";
// The tag editor as a modal, so a photo flagged in the review queue is edited
// right there — no scrolling to find the editor, no other page. Click the
// backdrop or press Escape to close (unless a nested dialog, like Add a
// university, is open).
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { overlay } from "@/app/admin/content-engine/[id]/ui";
import PhotoTagEditor, { type PhotoTagEditorProps } from "./PhotoTagEditor";

export default function PhotoTagDialog(props: PhotoTagEditorProps) {
  const { onClose, photo } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div style={{ ...overlay, alignItems: "flex-start", overflowY: "auto", padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Edit tags: ${photo.title}`} style={{ width: "100%", maxWidth: 820, margin: "16px auto" }}>
        <PhotoTagEditor {...props} />
      </div>
    </div>,
    document.body,
  );
}
