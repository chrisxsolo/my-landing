"use client";
// Green / yellow / red tagging status. Small enough to sit on a thumbnail or
// beside a title without changing the grid; clicking it opens the tag editor.
import type { CSSProperties } from "react";
import { T } from "@/app/admin/adminTheme";
import { STATUS_LABELS, type AuditedPhoto, type TagStatus } from "@/lib/photoTagging/types";

export const STATUS_TONE: Record<TagStatus, { color: string; bg: string; border: string }> = {
  full: { color: T.green, bg: T.greenBg, border: T.greenBorder },
  partial: { color: T.amber, bg: T.amberBg, border: T.amberBorder },
  needs: { color: T.red, bg: T.redBg, border: T.redBorder },
};

/** One line explaining what is missing, for the tooltip. */
export function statusDetail(photo: AuditedPhoto): string {
  const gaps = photo.checks.filter((c) => c.state === "missing").map((c) => c.note ?? c.field);
  const head = STATUS_LABELS[photo.status];
  return gaps.length ? `${head}: ${gaps.join("; ")}` : head;
}

interface Props {
  photo: AuditedPhoto | undefined;
  /** Dot-only, for thumbnails. */
  compact?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export default function TagStatusBadge({ photo, compact = false, onClick, style }: Props) {
  if (!photo) return null;
  const tone = STATUS_TONE[photo.status];
  const detail = statusDetail(photo);
  const suggestions = photo.suggestions.length;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={`${detail}${suggestions ? ` · ${suggestions} suggestion(s)` : ""} — click to edit tags`}
      aria-label={`Tagging status: ${detail}. Edit tags`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
        background: compact ? T.scrim : tone.bg, color: tone.color,
        border: `1px solid ${tone.border}`, borderRadius: 999,
        padding: compact ? "3px 6px" : "2px 9px", fontSize: 11, fontWeight: 800, lineHeight: 1.2,
        whiteSpace: "nowrap", ...style,
      }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: tone.color, flexShrink: 0 }} />
      {compact ? (suggestions > 0 ? <span>{suggestions}</span> : null) : STATUS_LABELS[photo.status]}
      {!compact && suggestions > 0 && <span style={{ opacity: 0.75 }}>· {suggestions} tip{suggestions === 1 ? "" : "s"}</span>}
    </button>
  );
}
