"use client";
// One photo in the draft journal picker. Two separate controls, never nested:
// the picture toggles whether the photo is in the journal, the bar under it
// makes the photo the cover. Both carry the filename in their accessible
// name so similar-looking files are told apart without the dropdown.
import type { CSSProperties } from "react";
import { T } from "@/app/admin/adminTheme";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";

export const TILE_WIDTH = 100;
const COVER_BAR_HEIGHT = 32;

export function photoDisplayName(photo: Pick<EnginePhoto, "id" | "original_filename">): string {
  return photo.original_filename ?? photo.id.slice(0, 8);
}

const badge: CSSProperties = {
  position: "absolute", top: 4, left: 4, padding: "1px 7px", borderRadius: 6,
  fontSize: 11, lineHeight: "16px", fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.04em",
};

function tileBorder(isCover: boolean, selected: boolean): string {
  if (isCover) return T.action;
  return selected ? T.green : T.border;
}

export function JournalPhotoTile({ photo, selected, isCover, disabled, onToggle, onMakeCover }: {
  photo: EnginePhoto;
  selected: boolean;
  isCover: boolean;
  disabled: boolean;
  onToggle: () => void;
  onMakeCover: () => void;
}) {
  const name = photoDisplayName(photo);
  const cursor = disabled ? "default" : "pointer";
  return (
    <div role="group" aria-label={name} style={{
      width: TILE_WIDTH, borderRadius: 10, overflow: "hidden", background: T.inset,
      border: `2px solid ${tileBorder(isCover, selected)}`,
      boxShadow: isCover ? T.glow : undefined, opacity: disabled ? 0.7 : 1,
    }}>
      <button type="button" disabled={disabled} onClick={onToggle} aria-pressed={selected}
        aria-label={selected ? `Remove ${name} from journal` : `Include ${name} in journal`}
        title={name}
        style={{
          position: "relative", display: "block", padding: 0, border: "none", width: "100%",
          height: TILE_WIDTH, background: T.inset, cursor,
        }}>
        {photo.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
          <img src={photo.thumbnailUrl} alt="" aria-hidden="true"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: selected ? 1 : 0.4 }} />
        )}
        {isCover ? (
          <span style={{ ...badge, background: T.action, color: T.actionText }}>Cover</span>
        ) : selected ? (
          <span style={{ ...badge, background: T.scrim, color: T.green }}>✓</span>
        ) : null}
        {selected && photo.excluded && (
          <span style={{
            position: "absolute", bottom: 3, left: 3, right: 3, padding: "0 4px", borderRadius: 6,
            fontSize: 10, lineHeight: "15px", textAlign: "center", background: T.scrim, color: T.amber,
          }}>excluded in library</span>
        )}
      </button>
      <button type="button" disabled={disabled} onClick={onMakeCover} aria-pressed={isCover}
        aria-label={isCover ? `${name} is the current journal cover` : `Make ${name} the journal cover`}
        style={{
          display: "block", width: "100%", height: COVER_BAR_HEIGHT, border: "none",
          borderTop: `1px solid ${T.rowBorder}`, fontSize: 11, fontWeight: 700, cursor: isCover ? "default" : cursor,
          background: isCover ? T.action : T.insetStrong, color: isCover ? T.actionText : T.inkSoft,
        }}>
        {isCover ? "★ Cover" : "Make cover"}
      </button>
    </div>
  );
}

/** A selected id whose session photo is gone: shown so it can be removed, never a cover. */
export function MissingPhotoTile({ id, disabled, onRemove }: {
  id: string; disabled: boolean; onRemove: () => void;
}) {
  const name = id.slice(0, 8);
  return (
    <div role="group" aria-label={`Missing photo ${name}`} style={{
      width: TILE_WIDTH, borderRadius: 10, overflow: "hidden", border: `2px dashed ${T.amberBorder}`,
      background: T.amberBg, color: T.amber, display: "grid", gridTemplateRows: `${TILE_WIDTH}px ${COVER_BAR_HEIGHT}px`,
    }}>
      <button type="button" disabled={disabled} onClick={onRemove}
        aria-label={`Remove missing photo ${name} from journal`}
        title="This selected photo no longer exists in the session"
        style={{ border: "none", background: "transparent", color: "inherit", fontSize: 11, cursor: disabled ? "default" : "pointer" }}>
        missing ✕
      </button>
      <span aria-hidden="true" style={{ fontSize: 11, lineHeight: `${COVER_BAR_HEIGHT}px`, textAlign: "center", opacity: 0.7 }}>
        no photo
      </span>
    </div>
  );
}
