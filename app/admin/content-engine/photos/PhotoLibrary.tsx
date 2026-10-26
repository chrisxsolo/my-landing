"use client";
// Every Portfolio and Content Engine photo in one grid with its tagging
// status — the connected library. Click a photo to select it for bulk
// tagging; click its status badge to open the tag editor. Paged, lazy-loaded
// thumbnails keep it fast as the library grows.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";
import { btn, card, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import type { AuditedPhoto, TagFilter } from "@/lib/photoTagging/types";
import BulkTagBar from "@/app/admin/photoTagging/BulkTagBar";
import PhotoTagEditor from "@/app/admin/photoTagging/PhotoTagEditor";
import PhotoTagToolbar from "@/app/admin/photoTagging/PhotoTagToolbar";
import TagStatusBadge from "@/app/admin/photoTagging/TagStatusBadge";
import { taggingApi } from "@/app/admin/photoTagging/taggingApi";
import { usePhotoTagging } from "@/app/admin/photoTagging/usePhotoTagging";

const PAGE_SIZE = 60;
const THUMB_WIDTH = 320;
const SOURCES = [["", "All sources"], ["portfolio", "Portfolio"], ["engine", "Content Engine only"]] as const;

function thumbOf(photo: AuditedPhoto, signed: Record<string, string>): string | null {
  if (photo.url) return supabaseImageLoader({ src: photo.url, width: THUMB_WIDTH, quality: 60 });
  return signed[photo.key] ?? null;
}

function Tile({ photo, src, selected, onSelect, onOpen }: {
  photo: AuditedPhoto; src: string | null; selected: boolean; onSelect: () => void; onOpen: () => void;
}) {
  return (
    <figure style={{
      margin: 0, borderRadius: 10, overflow: "hidden", position: "relative", cursor: "pointer",
      border: `1px solid ${selected ? T.action : T.border}`, boxShadow: selected ? T.glow : undefined,
    }} onClick={onSelect} title="Click to select for bulk tagging">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized transform / signed URL
        <img src={src} alt={photo.title} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
      ) : <div style={{ aspectRatio: "1", background: T.inset }} />}
      <TagStatusBadge photo={photo} compact onClick={onOpen} style={{ position: "absolute", top: 6, left: 6 }} />
      {selected && (
        <span style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 999, background: T.action,
          color: T.actionText, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>✓</span>
      )}
      <figcaption style={{ padding: "5px 7px", fontSize: 11, color: T.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {photo.source === "engine" ? "⚙ " : ""}{photo.sessionName ?? photo.title}
      </figcaption>
    </figure>
  );
}

export default function PhotoLibrary({ initialFilter }: { initialFilter: TagFilter }) {
  const tagging = usePhotoTagging({ initialFilter: { filter: initialFilter } });
  const { report, filter, selected } = tagging;
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Private thumbnails are signed once per visit, never on refresh.
  useEffect(() => {
    taggingApi.thumbs().then((r) => setThumbs(r.thumbs)).catch((err) => console.error("[photo-tagging] thumbnails failed", err));
  }, []);

  const scoped = useMemo(() => (report?.photos ?? []).filter((p) => !source || p.source === source), [report, source]);
  const { visible } = tagging;
  const shown = useMemo(() => scoped.filter((p) => visible(p.key)), [scoped, visible]);
  const changeFilter = (next: typeof filter) => { tagging.setFilter(next); setPage(0); };
  const changeSource = (next: string) => { setSource(next); setPage(0); };
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pagePhotos = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const open = openKey ? tagging.byKey.get(openKey) : undefined;
  const selectedPhotos = [...selected].map((k) => tagging.byKey.get(k)).filter((p): p is AuditedPhoto => Boolean(p));

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ ...sectionTitle, fontSize: 22, margin: 0 }}>Photo tagging</h1>
        <Link href="/admin/content-engine" style={{ color: T.blue, fontSize: 13 }}>← Content Engine</Link>
      </div>
      {tagging.error && <p style={{ color: T.red, fontSize: 13 }}>{tagging.error}</p>}
      {report?.errors.length ? <p style={{ color: T.red, fontSize: 13 }}>Audit incomplete: {report.errors.join("; ")}</p> : null}

      <section style={{ ...card, marginBottom: 0, display: "grid", gap: 10 }}>
        <PhotoTagToolbar photos={scoped} options={report?.options ?? null} filter={filter} setFilter={changeFilter} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {SOURCES.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={source === value} onClick={() => changeSource(value)}
              style={{ ...btn(source === value), padding: "3px 10px", fontSize: 12 }}>{label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }} disabled={shown.length === 0}
            onClick={() => tagging.selectMany(shown.map((p) => p.key))}>Select all {shown.length} shown</button>
        </div>
      </section>

      {report && selectedPhotos.length > 0 && (
        <BulkTagBar photos={selectedPhotos} options={report.options} onChanged={tagging.refresh} onClear={tagging.clearSelection} />
      )}
      {report && open && (
        <PhotoTagEditor photo={open} options={report.options} onChanged={tagging.refresh} onClose={() => setOpenKey(null)} />
      )}

      {tagging.loading ? <p style={{ color: T.inkSoft }}>Checking every photo…</p> : shown.length === 0 ? (
        <p style={{ color: T.inkSoft, textAlign: "center", padding: 24 }}>No photos match this filter.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {pagePhotos.map((p) => (
            <Tile key={p.key} photo={p} src={thumbOf(p, thumbs)} selected={selected.has(p.key)}
              onSelect={() => tagging.toggle(p.key)} onOpen={() => { setOpenKey(p.key); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          ))}
        </div>
      )}
      {pageCount > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <button type="button" style={btn(false)} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ color: T.inkSoft, fontSize: 13 }}>Page {page + 1} of {pageCount} · {shown.length} photos</span>
          <button type="button" style={btn(false)} disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
