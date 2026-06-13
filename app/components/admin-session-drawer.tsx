"use client";

import { useEffect } from "react";
import { T } from "@/app/admin/adminTheme";

type AdminSessionDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Darkroom slide-over: right-side panel above the scrim, Escape/✕/scrim-click to close. */
export default function AdminSessionDrawer({ open, title, onClose, children }: AdminSessionDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: T.scrim, backdropFilter: "blur(6px)" }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="h-full w-full max-w-2xl overflow-y-auto border-l p-5 md:p-7"
        style={{ background: T.panelSolid, borderColor: T.border, boxShadow: T.shadow }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 flex-shrink-0 rounded-lg border text-sm font-black"
            style={{ background: T.panel, borderColor: T.border, color: T.inkSoft }}
          >
            ✕
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
