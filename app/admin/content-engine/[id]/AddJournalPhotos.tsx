"use client";
// Adds more of the session's uploaded photos to an ALREADY-published blog/
// journal post (publishing seeds only a few). Lists photos not already in the
// post; selected photos get public derivatives and are appended to the live
// post server-side. Shown under the post in Publication history.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { EngineItem, EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { btn, input } from "./ui";

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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {candidates.map((p) => {
              const on = selected.has(p.id);
              return (
                <button key={p.id} onClick={() => toggle(p.id)}
                  style={{
                    ...input, width: "auto", cursor: "pointer",
                    opacity: on ? 1 : 0.55,
                    borderColor: on ? T.violet : T.border,
                  }}>
                  {on ? "✓ " : ""}{p.original_filename ?? p.id.slice(0, 8)}
                  {p.quality_score ? ` (q${p.quality_score})` : ""}
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
