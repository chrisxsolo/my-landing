"use client";
// Picks the new cover for a live journal post from photos that already exist:
// the post's gallery, or session photos with a public web copy that are not
// yet in the post. Nothing is uploaded. The caller decides what the choice
// means (replace = old cover moves to the gallery; remove = old cover leaves).
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import type { LiveJournalPhoto } from "@/lib/contentEngine/journalPhotoMembership";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import { btn, overlay } from "./ui";

const THUMB_WIDTH = 256;

export interface CoverCandidate {
  url: string;
  label: string;
  /** Already shown on the live page (gallery) vs. only published from the session. */
  inPost: boolean;
}

/** Gallery photos first, then the session's other published photos. */
export function coverCandidates(live: LiveJournalPhoto[], photos: EnginePhoto[]): CoverCandidate[] {
  const liveUrls = new Set(live.map((p) => p.url));
  const gallery = live.filter((p) => p.role === "gallery")
    .map((p): CoverCandidate => ({ url: p.url, label: p.filename ?? "gallery photo", inPost: true }));
  const session = photos
    .filter((p) => p.public_derivative_url && !p.excluded && !liveUrls.has(p.public_derivative_url))
    .map((p): CoverCandidate => ({ url: p.public_derivative_url as string, label: p.original_filename ?? p.id.slice(0, 8), inPost: false }));
  return [...gallery, ...session];
}

export default function CoverPicker({ mode, candidates, busy, onPick, onClose }: {
  mode: "replace" | "remove";
  candidates: CoverCandidate[];
  busy: boolean;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const title = mode === "remove" ? "Remove the cover — choose its replacement" : "Choose the new cover";
  const note = mode === "remove"
    ? "A post is never left without a cover: the current cover leaves the post once you pick another photo."
    : "The current cover moves into the gallery. The social-share image changes with the cover.";
  return (
    <div style={overlay} onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} style={{
        background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16,
        width: "min(880px, 100%)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 10, color: T.ink,
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontFamily: T.display, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>{note}</p>
        {candidates.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: T.amber }}>
            No other photo is available yet — add photos to the post first, then come back.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))", gap: 8 }}>
            {candidates.map((c) => {
              const on = selected === c.url;
              return (
                <button key={c.url} onClick={() => setSelected(c.url)} title={c.label} style={{
                  position: "relative", padding: 0, textAlign: "left", overflow: "hidden", background: T.inset,
                  borderRadius: 10, border: `2px solid ${on ? T.action : T.border}`, cursor: "pointer",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail via the Supabase transform URL */}
                  <img src={supabaseImageLoader({ src: c.url, width: THUMB_WIDTH })} alt={c.label} loading="lazy"
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  <span style={{
                    display: "block", padding: "4px 6px", fontSize: 10, color: c.inPost ? T.inkSoft : T.violet,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {c.inPost ? c.label : `${c.label} · not in post yet`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={btn(false)} onClick={onClose} disabled={busy}>Cancel</button>
          <button style={btn(true)} disabled={busy || !selected} onClick={() => selected && onPick(selected)}>
            {busy ? "Updating…" : mode === "remove" ? "Remove old cover, use this one" : "Make this the cover"}
          </button>
        </div>
      </section>
    </div>
  );
}
