"use client";
// Adds more of the session's uploaded photos to an ALREADY-published blog/
// journal post (publishing seeds only a few). Lists photos not already in the
// post; selected photos get public derivatives and are appended to the live
// post server-side. Shown under the post in Publication history.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { EngineItem, EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { btn } from "./ui";

const MAX_PER_ADD = 12;
const asIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export default function AddJournalPhotos({ item, photos, onChanged }: {
  item: EngineItem; photos: EnginePhoto[]; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const inPost = new Set<string>([
    ...asIds(item.payload.photo_ids),
    ...(typeof item.payload.cover_photo_id === "string" ? [item.payload.cover_photo_id] : []),
  ]);
  const candidates = photos.filter((p) => !p.excluded && !inPost.has(p.id));
  if (candidates.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_ADD) next.add(id);
      return next;
    });

  const add = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await engineApi.addJournalPhotos(item.id, [...selected]);
      setNotice(`Added ${r.added} photo${r.added === 1 ? "" : "s"} — ${r.totalExtras} now in the post.`);
      setSelected(new Set());
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not add photos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 4 }}>
      <button style={btn(false)} onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : `Add photos (${candidates.length} more uploaded)`}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))", gap: 8 }}>
            {candidates.map((p) => {
              const on = selected.has(p.id);
              const atCap = !on && selected.size >= MAX_PER_ADD;
              return (
                <button key={p.id} onClick={() => toggle(p.id)} disabled={atCap}
                  title={p.original_filename ?? undefined}
                  style={{
                    position: "relative", padding: 0, textAlign: "left", overflow: "hidden",
                    background: T.inset, borderRadius: 10,
                    border: `2px solid ${on ? T.violet : T.border}`,
                    cursor: atCap ? "not-allowed" : "pointer", opacity: atCap ? 0.4 : 1,
                  }}>
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
                    <img src={p.thumbnailUrl} alt={p.alt_text ?? p.original_filename ?? "session photo"}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ aspectRatio: "1", background: T.inset }} />
                  )}
                  {on && (
                    <span style={{
                      position: "absolute", top: 5, right: 5, height: 20, minWidth: 20, padding: "0 5px",
                      borderRadius: 999, background: T.violet, color: T.actionText,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                    }}>✓</span>
                  )}
                  <span style={{
                    display: "block", padding: "4px 6px", fontSize: 10, color: T.inkSoft,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {p.original_filename ?? p.id.slice(0, 8)}{p.quality_score ? ` · q${p.quality_score}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={btn(true)} disabled={busy || selected.size === 0} onClick={() => void add()}>
              {busy ? "Adding…" : `Add ${selected.size || ""} to live post`.trim()}
            </button>
            <span style={{ fontSize: 11, color: T.inkSoft }}>up to {MAX_PER_ADD} at a time</span>
          </div>
          {notice && (
            <p style={{ fontSize: 12, color: notice.startsWith("Added") ? T.inkSoft : T.red, margin: 0 }}>{notice}</p>
          )}
        </div>
      )}
    </div>
  );
}
