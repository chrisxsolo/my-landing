"use client";
// Journal editor (spec §7.4): title/slug/body/meta, photo picker (cover +
// extras from analyzed photos), and the structured internal-links list
// (payload.internal_links — rendered into "Keep exploring" at publish, §9.3).
import { T } from "@/app/admin/adminTheme";
import { internalLinksForService, isServiceType } from "@/lib/contentEngine/taxonomy";
import { serviceConfigFor } from "@/lib/contentEngine/serviceConfig";
import { PhotoThumb, type EditorProps } from "./editorsSimple";
import { input, label } from "./ui";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

export function JournalEditor({ payload, photos, onEdit, disabled, serviceType }: EditorProps) {
  const photoIds = arr(payload.photo_ids);
  const links = Array.isArray(payload.internal_links)
    ? (payload.internal_links as { url: string; label: string }[]) : [];
  const candidates = photos.filter((p) => !p.excluded && p.analysis_status === "completed");
  const service = isServiceType(serviceType) ? serviceType : "grads";
  const linkCandidates = internalLinksForService(service);
  const keywordsPlaceholder = serviceConfigFor(service).keywordsPlaceholder;

  const togglePhoto = (id: string) => {
    const next = photoIds.includes(id) ? photoIds.filter((p) => p !== id) : [...photoIds, id];
    const cover = str(payload.cover_photo_id);
    onEdit({
      ...payload,
      photo_ids: next,
      cover_photo_id: next.includes(cover) ? cover : (next[0] ?? ""),
    });
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
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
        <span style={label}>Photos (click to toggle; ◉ = cover, set below)</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {candidates.map((p) => {
            const selected = photoIds.includes(p.id);
            const isCover = str(payload.cover_photo_id) === p.id;
            return (
              <button key={p.id} disabled={disabled} onClick={() => togglePhoto(p.id)}
                title={p.original_filename ?? p.id.slice(0, 8)}
                style={{
                  position: "relative", padding: 0, width: 84, height: 84,
                  border: `2px solid ${selected ? T.green : T.border}`, borderRadius: 8,
                  overflow: "hidden", cursor: disabled ? "default" : "pointer",
                  background: T.inset, opacity: selected ? 1 : 0.45,
                }}>
                {p.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
                  <img src={p.thumbnailUrl} alt={p.alt_text ?? p.original_filename ?? "session photo"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                )}
                {(selected || isCover) && (
                  <span style={{
                    position: "absolute", top: 3, left: 3, padding: "0 5px",
                    borderRadius: 6, fontSize: 11, lineHeight: "16px",
                    background: "rgba(0,0,0,0.65)", color: "#fff",
                  }}>
                    {isCover ? "◉ cover" : "✓"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span style={label}>Cover photo</span>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <PhotoThumb photo={photos.find((x) => x.id === str(payload.cover_photo_id))} size={56} />
          <select style={input} disabled={disabled} value={str(payload.cover_photo_id)}
            onChange={(e) => onEdit({ ...payload, cover_photo_id: e.target.value })}>
            {photoIds.map((id) => {
              const p = photos.find((x) => x.id === id);
              return <option key={id} value={id}>{p?.original_filename ?? id.slice(0, 8)}</option>;
            })}
          </select>
        </div>
      </div>

      <div>
        <span style={label}>Internal links (&quot;Keep exploring&quot; section at publish)</span>
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
