"use client";
// Journal editor (spec §7.4): title/slug/body/meta, photo picker (include /
// remove and choose the cover directly on each photo; the membership rules
// live in lib/contentEngine/journalCoverSelection), and the structured internal-links list
// (payload.internal_links — the pages the body may link; links are written
// inside the body's paragraphs, nothing is appended at publish).
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { internalLinksForService, isServiceType } from "@/lib/contentEngine/taxonomy";
import { serviceConfigFor } from "@/lib/contentEngine/serviceConfig";
import {
  chooseCover, refusalMessage, toggleInclusion, type SelectionResult,
} from "@/lib/contentEngine/journalCoverSelection";
import { PhotoThumb, type EditorProps } from "./editorsSimple";
import { PendingGuideLinksNote } from "./editorsLocationGuide";
import { JournalPhotoTile, MissingPhotoTile, photoDisplayName } from "./journalPhotoTile";
import { input, label } from "./ui";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

export function JournalEditor(props: EditorProps) {
  const { payload, photos, onEdit, disabled, serviceType } = props;
  const photoIds = arr(payload.photo_ids);
  const links = Array.isArray(payload.internal_links)
    ? (payload.internal_links as { url: string; label: string }[]) : [];
  // Selected photos ALWAYS show (even if later excluded in the library), so
  // nothing in the journal is hidden from the picker; selected ids with no
  // session photo at all show as "missing" tiles that can be toggled off.
  const candidates = photos.filter((p) =>
    photoIds.includes(p.id) || (!p.excluded && p.analysis_status === "completed"));
  const missingIds = photoIds.filter((id) => !photos.some((p) => p.id === id));
  const service = isServiceType(serviceType) ? serviceType : "grads";
  const linkCandidates = internalLinksForService(service);
  const keywordsPlaceholder = serviceConfigFor(service).keywordsPlaceholder;

  const coverId = str(payload.cover_photo_id);
  const existing = new Set(photos.map((p) => p.id));
  const selection = { photo_ids: photoIds, cover_photo_id: coverId };
  // Only a notice lives here; the photo list and cover are read from the
  // payload so the tiles, the preview and the dropdown can never disagree.
  const [notice, setNotice] = useState<string | null>(null);
  const nameOf = (id: string) => {
    const p = photos.find((x) => x.id === id);
    return p ? photoDisplayName(p) : id.slice(0, 8);
  };
  // One onEdit per click: photo_ids and cover_photo_id change together, so
  // the autosaved payload always satisfies "photo_ids contains cover_photo_id".
  const applySelection = (result: SelectionResult, id: string) => {
    if (!result.ok) { setNotice(refusalMessage(result.reason, nameOf(id))); return; }
    setNotice(null);
    onEdit({ ...payload, ...result.selection });
  };
  const togglePhoto = (id: string) => applySelection(toggleInclusion(selection, id, existing), id);
  const makeCover = (id: string) => applySelection(chooseCover(selection, id, existing), id);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <PendingGuideLinksNote {...props} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div>
          <span style={label}>Title</span>
          <input style={input} value={str(payload.title)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, title: e.target.value })} />
        </div>
        <div>
          <span style={label}>Slug</span>
          <input style={input} value={str(payload.slug)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, slug: e.target.value })} />
        </div>
      </div>
      <div>
        <span style={label}>Body (markdown)</span>
        <textarea style={{ ...input, minHeight: 220, fontFamily: "monospace" }}
          value={str(payload.body)} disabled={disabled}
          onChange={(e) => onEdit({ ...payload, body: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <span style={label}>Meta description</span>
          <textarea style={{ ...input, minHeight: 48 }} value={str(payload.meta_description)} disabled={disabled}
            onChange={(e) => onEdit({ ...payload, meta_description: e.target.value })} />
        </div>
        <div>
          <span style={label}>Meta keywords (deterministic; editable)</span>
          <textarea style={{ ...input, minHeight: 48 }} value={str(payload.meta_keywords)} disabled={disabled}
            placeholder={keywordsPlaceholder}
            onChange={(e) => onEdit({ ...payload, meta_keywords: e.target.value })} />
        </div>
      </div>

      <div>
        <span style={label}>Journal photos</span>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: T.inkSoft }}>
          Click a photo to include it in the journal or take it out. Use <strong>Make cover</strong> under
          any photo to choose the cover directly; it is included automatically.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {candidates.map((p) => (
            <JournalPhotoTile key={p.id} photo={p} disabled={disabled}
              selected={photoIds.includes(p.id)} isCover={coverId === p.id}
              onToggle={() => togglePhoto(p.id)} onMakeCover={() => makeCover(p.id)} />
          ))}
          {missingIds.map((id) => (
            <MissingPhotoTile key={id} id={id} disabled={disabled} onRemove={() => togglePhoto(id)} />
          ))}
        </div>
        <p role="status" aria-live="polite" style={{ margin: notice ? "6px 0 0" : 0, fontSize: 12, color: T.amber }}>
          {notice}
        </p>
        <span style={{ ...label, marginTop: 8 }}>Cover photo</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <PhotoThumb photo={photos.find((x) => x.id === coverId)} size={56} />
          <select style={input} disabled={disabled} value={coverId} aria-label="Journal cover (choose by filename)"
            onChange={(e) => makeCover(e.target.value)}>
            {!existing.has(coverId) && <option value={coverId}>{coverId ? "missing photo" : "no cover yet"}</option>}
            {photoIds.filter((id) => existing.has(id)).map((id) => (
              <option key={id} value={id}>{nameOf(id)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span style={label}>Allowed internal links (link them inside the body text)</span>
        {links.map((link, i) => (
          <div key={`${link.url}-${i}`} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <code style={{ fontSize: 12, alignSelf: "center", whiteSpace: "nowrap" }}>{link.url}</code>
            <input style={input} value={link.label} disabled={disabled}
              onChange={(e) => onEdit({
                ...payload,
                internal_links: links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
              })} />
            <button style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }} disabled={disabled}
              onClick={() => onEdit({ ...payload, internal_links: links.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <select style={input} disabled={disabled} value=""
          onChange={(e) => {
            if (!e.target.value) return;
            onEdit({
              ...payload,
              internal_links: [...links, { url: e.target.value, label: e.target.value }],
            });
          }}>
          <option value="">+ add canonical link…</option>
          {linkCandidates.filter((u) => !links.some((l) => l.url === u))
            .map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}
