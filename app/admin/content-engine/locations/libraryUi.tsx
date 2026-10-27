// Small shared pieces for the Locations admin, built on the engine's Darkroom
// primitives so the section matches the rest of the Content Engine.
import type { CSSProperties, ReactNode } from "react";
import { T } from "@/app/admin/adminTheme";
import { chip } from "@/app/admin/content-engine/[id]/ui";
import { CONTENT_STATUS, type ContentStatusMeta } from "@/lib/contentStatus";

const statusChip = ({ label, color, bg }: ContentStatusMeta) => ({ label, style: chip(color, bg) });

// Keyed by LocationStatus (lib/locationLibrary/adminView statusOf).
export const STATUS_CHIP: Record<string, { label: string; style: CSSProperties }> = {
  published: statusChip(CONTENT_STATUS.published),
  review: statusChip(CONTENT_STATUS.needs_review),
  unpublished: statusChip(CONTENT_STATUS.hidden),
};

// A session's location sync. Its stored "needs_review" means the place could
// not be resolved, which is not content review, so it gets its own key here.
type SyncChipKey = "synced" | "needs_location" | "waiting" | "error";
const SYNC_CHIP: Record<SyncChipKey, { label: string; style: CSSProperties }> = {
  synced: { label: "Synced", style: chip(T.green, T.greenBg) },
  needs_location: { label: "Needs a location", style: chip(T.amber, T.amberBg) },
  waiting: { label: "Waiting for approval", style: chip(T.blue, T.blueBg) },
  error: { label: "Error", style: chip(T.red, T.redBg) },
};
const neutralChip = (label: string) => ({ label, style: chip(T.inkFaint, T.neutralBg) });

/** The stored sync status (SyncStatus, or null before any sync) → its chip. */
export function syncChipFor(status: string | null): { label: string; style: CSSProperties } {
  if (!status) return neutralChip("Not synced");
  const key = status === "needs_review" ? "needs_location" : status;
  return Object.hasOwn(SYNC_CHIP, key) ? SYNC_CHIP[key as SyncChipKey] : neutralChip(status);
}

export const HERO_LABEL: Record<string, string> = {
  featured_photo: "Selected",
  manual_image: "Manual photo",
  auto: "Automatic",
};

export function Notice({ notice, onClose }: { notice: { msg: string; ok: boolean } | null; onClose: () => void }) {
  if (!notice) return null;
  return (
    <div role="status" onClick={onClose} style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 60, cursor: "pointer",
      background: notice.ok ? T.greenBg : T.redBg, color: notice.ok ? T.green : T.red,
      border: `1px solid ${notice.ok ? T.greenBorder : T.redBorder}`, borderRadius: 12, padding: "10px 16px",
      fontSize: 13, fontWeight: 700, boxShadow: T.shadow, backdropFilter: "blur(12px)", maxWidth: "min(92vw, 560px)",
    }}>
      {notice.msg}
    </div>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ margin: 0, fontSize: 12, color: T.inkFaint, lineHeight: 1.5, ...style }}>{children}</p>;
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const selectStyle: CSSProperties = {
  border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px", background: T.inset,
  color: T.ink, fontSize: 13, colorScheme: "dark", minWidth: 0,
};
