"use client";
// The images a published blog post renders, for the legacy Blog tab: cover,
// gallery and social image read from the live post record, each removable or
// replaceable in place, plus the post's revision history with restore. The
// same data the Content Engine shows for its journals, so a post edited in
// either place is traceable here.
import { useCallback, useEffect, useState } from "react";
import { C } from "@/lib/colors";
import { blogPostsApi } from "@/app/admin/blogPostsApi";
import type { PostImageInventory } from "@/lib/blog/publishedImages";
import type { LiveJournalPhoto } from "@/lib/contentEngine/journalPhotoMembership";
import type { RevisionSummary } from "@/lib/blog/postRevisions";

type Props = {
  postId: number;
  showToast: (msg: string, ok?: boolean) => void;
  /** The live row changed (cover, gallery or a restore); the caller refetches its list. */
  onChanged: () => void;
};

const smallBtn = "text-xs font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-50";
const SHOW_AT_FIRST = 5;

function roleLabel(p: LiveJournalPhoto): string {
  if (p.role === "cover") return "Cover";
  if (p.role === "og") return p.fallback ? "Social image (falls back to the cover)" : "Social image";
  return `Gallery #${(p.source.index ?? 0) + 1}`;
}

function CoverPickerRow({ gallery, mode, busy, onPick, onCancel }: {
  gallery: LiveJournalPhoto[]; mode: "replace" | "remove"; busy: boolean;
  onPick: (url: string) => void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: C.p1_04, border: `1.5px dashed ${C.p1_20}` }}>
      <p className="text-xs font-bold" style={{ color: C.p1 }}>
        {mode === "remove" ? "Pick the photo that replaces the cover (the current cover leaves the post)." : "Pick the new cover (the current cover moves into the gallery)."}
      </p>
      {gallery.length === 0 ? (
        <p className="text-xs text-slate-500">No gallery photo to promote — add photos to the post first.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {gallery.map((p) => (
            <button key={p.url} type="button" onClick={() => setSelected(p.url)} title={p.filename ?? p.url}
              className="aspect-square rounded-lg overflow-hidden border-2" style={{ borderColor: selected === p.url ? C.p1 : "transparent" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              <img src={p.url} alt={p.alt || "gallery photo"} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={busy || !selected} onClick={() => selected && onPick(selected)}
          className={`${smallBtn} text-white`} style={{ background: C.p1 }}>{busy ? "Updating…" : "Use as cover"}</button>
        <button type="button" disabled={busy} onClick={onCancel} className={`${smallBtn} bg-slate-100 text-slate-500`}>Cancel</button>
      </div>
    </div>
  );
}

function RevisionList({ revisions, busy, onRestore }: {
  revisions: RevisionSummary[]; busy: boolean; onRestore: (r: RevisionSummary) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? revisions : revisions.slice(0, SHOW_AT_FIRST);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Revision history ({revisions.length})</p>
      {revisions.length === 0 && <p className="text-xs text-slate-400">No saved revisions yet — every edit from now on is kept.</p>}
      {shown.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-xs text-slate-600">
          <span className="flex-1 truncate">
            {new Date(r.changedAt).toLocaleString()} · {r.operation === "delete" ? "before deletion" : "before edit"} · “{r.title || r.slug}” · {r.coverImageUrl ? "cover + " : "no cover, "}{r.galleryCount} gallery
          </span>
          <button type="button" disabled={busy} onClick={() => onRestore(r)} className={`${smallBtn} bg-slate-100 text-slate-700`}>Restore</button>
        </div>
      ))}
      {revisions.length > SHOW_AT_FIRST && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="text-xs font-bold underline text-slate-400">
          {showAll ? "Show fewer" : `Show all ${revisions.length}`}
        </button>
      )}
    </div>
  );
}

export default function BlogPostImages({ postId, showToast, onChanged }: Props) {
  const [inventory, setInventory] = useState<PostImageInventory | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<"replace" | "remove" | null>(null);

  const load = useCallback(async () => {
    try {
      const [inv, revs] = await Promise.all([blogPostsApi.images(postId), blogPostsApi.revisions(postId)]);
      setInventory(inv);
      setRevisions(revs.revisions);
    } catch (err) {
      console.error("[blog] could not load the post's images", err);
      showToast(err instanceof Error ? err.message : "Could not load the post's images", false);
    }
  }, [postId, showToast]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      showToast(await action());
      await load();
      onChanged();
    } catch (err) {
      console.error("[blog] post image change failed", err);
      showToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusy(false);
    }
  };

  const remove = (p: LiveJournalPhoto) => {
    if (!confirm("Remove this photo from the published post? The file stays in storage.")) return;
    void run(async () => `Removed — ${(await blogPostsApi.removeGalleryImage(postId, p.url)).remaining} gallery photos left`);
  };
  const pickCover = (url: string) => {
    const keepOld = picker === "replace";
    setPicker(null);
    void run(async () => { await blogPostsApi.replaceCover(postId, url, keepOld); return "Cover and social image updated"; });
  };
  const restore = (r: RevisionSummary) => {
    if (!confirm(`Restore the post as it was on ${new Date(r.changedAt).toLocaleString()}? The current state is kept as a revision.`)) return;
    void run(async () => { await blogPostsApi.restoreRevision(postId, r.id); return "Revision restored"; });
  };

  if (!inventory) return <p className="text-xs text-slate-400 px-4 pb-4">Loading published images…</p>;
  const tiles = inventory.photos.filter((p) => p.role !== "og");
  const og = inventory.photos.find((p) => p.role === "og");
  return (
    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Published images ({tiles.length}) — what the page renders</p>
        <a href={`/blog/${inventory.slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold" style={{ color: C.p1 }}>Open live page ↗</a>
      </div>
      {inventory.engine && (
        <p className="text-xs text-slate-500">Published by the Content Engine — the engine workspace manages this post too.</p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {tiles.map((p, i) => (
          <div key={`${p.url}-${i}`} className="rounded-xl overflow-hidden border border-slate-100 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
            <img src={p.url} alt={p.alt || roleLabel(p)} className="w-full aspect-square object-cover" />
            <div className="p-1.5 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 truncate" title={p.url}>{roleLabel(p)}{p.filename ? ` · ${p.filename}` : ""}</p>
              {p.role === "cover" ? (
                <div className="flex gap-1">
                  <button type="button" disabled={busy} onClick={() => setPicker("replace")} className={`${smallBtn} bg-slate-100 text-slate-700`}>Replace</button>
                  <button type="button" disabled={busy} onClick={() => setPicker("remove")} className={`${smallBtn} text-white`} style={{ background: "#be123c" }}>Remove</button>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => remove(p)} className={`${smallBtn} text-white`} style={{ background: "#be123c" }}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {og && <p className="text-xs text-slate-500">{roleLabel(og)}: {og.fallback ? "the cover is used" : og.url === tiles[0]?.url ? "set to the cover" : og.url}. Replacing the cover updates it.</p>}
      {picker && (
        <CoverPickerRow gallery={tiles.filter((p) => p.role === "gallery")} mode={picker} busy={busy} onPick={pickCover} onCancel={() => setPicker(null)} />
      )}
      <RevisionList revisions={revisions} busy={busy} onRestore={restore} />
    </div>
  );
}
