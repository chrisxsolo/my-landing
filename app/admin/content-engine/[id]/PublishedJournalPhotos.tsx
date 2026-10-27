"use client";
// Every image the PUBLISHED journal post renders — cover, gallery, social
// image — read from the live blog_posts row itself (not the engine's
// selection), so the editor and the page can't disagree. Shown open: a photo
// that reached the page by mistake must be visible here, with a way out.
// Removing a gallery photo drops only this post's association; the file and
// the session photo stay. The cover is replaced, never removed, so the post
// is never left bare. When the saved draft lists other photos than the page
// shows, a warning says so with a one-click fix.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { EngineItem, EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import type { LiveJournalPhoto } from "@/lib/contentEngine/journalPhotoMembership";
import type { PostImageInventory } from "@/lib/blog/publishedImages";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import AddJournalPhotos from "./AddJournalPhotos";
import CoverPicker, { coverCandidates } from "./CoverPicker";
import PostRevisions from "./PostRevisions";
import { btn, chip, label } from "./ui";

const THUMB_WIDTH = 256;

function PhotoTile({ photo, busy, onRemove, onReplaceCover, onRemoveCover }: {
  photo: LiveJournalPhoto; busy: boolean;
  onRemove: () => void; onReplaceCover: () => void; onRemoveCover: () => void;
}) {
  const isCover = photo.role === "cover";
  const smallBtn = { ...btn(false), padding: "3px 8px", fontSize: 11 };
  return (
    <div style={{
      display: "grid", gridTemplateRows: "auto auto", overflow: "hidden", borderRadius: 10,
      background: T.inset, border: `1px solid ${photo.photoId ? T.border : T.amberBorder}`,
    }}>
      <div style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail via the Supabase transform URL */}
        <img src={supabaseImageLoader({ src: photo.url, width: THUMB_WIDTH })} alt={photo.alt || "journal photo"}
          loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
        <span style={{ ...chip(T.green, T.greenBg), position: "absolute", top: 5, left: 5, fontSize: 10 }}>
          {isCover ? "Published · cover" : "Published"}
        </span>
      </div>
      <div style={{ padding: "5px 6px", display: "grid", gap: 4 }}>
        <span title={photo.url} style={{
          fontSize: 11, color: photo.photoId ? T.inkSoft : T.amber,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {photo.filename ?? "Unmatched photo (added outside the engine)"}
        </span>
        {photo.excludedInLibrary && (
          <span style={{ fontSize: 10, color: T.inkFaint }}>excluded in library, still published</span>
        )}
        {isCover ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button style={smallBtn} disabled={busy} onClick={onReplaceCover} title="Pick another photo as the cover; this one moves to the gallery">Replace</button>
            <button style={{ ...smallBtn, ...btn(false, true), padding: "3px 8px" }} disabled={busy} onClick={onRemoveCover}
              title="Pick a replacement; this photo leaves the post">Remove</button>
          </div>
        ) : (
          <button style={{ ...smallBtn, ...btn(false, true), padding: "3px 8px" }} disabled={busy} onClick={onRemove}
            title="Remove from this post only">{busy ? "Removing…" : "Remove from post"}</button>
        )}
      </div>
    </div>
  );
}

/** The og image never gets its own tile: it is the cover, or a URL the page reads from og_image_url. */
function SocialImageRow({ live }: { live: LiveJournalPhoto[] }) {
  const og = live.find((p) => p.role === "og");
  if (!og) return null;
  const cover = live.find((p) => p.role === "cover");
  const text = og.fallback ? "the cover (og_image_url is empty)"
    : og.url === cover?.url ? "set to the cover" : `a separate image — ${og.url}`;
  return (
    <p style={{ fontSize: 12, color: T.inkSoft, margin: 0 }}>
      Social-share image: {text}. Replacing the cover updates it.
    </p>
  );
}

function DriftWarning({ inventory, busy, onFix }: { inventory: PostImageInventory; busy: boolean; onFix: () => void }) {
  const drift = inventory.engine?.drift;
  if (!drift || drift.inSync) return null;
  const parts = [
    drift.missingFromLive.length > 0 && `${drift.missingFromLive.length} selected in the draft but not on the page`,
    drift.missingFromPayload.length > 0 && `${drift.missingFromPayload.length} on the page but not in the draft`,
    drift.coverMismatch && "the draft's cover differs from the published cover",
  ].filter(Boolean);
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderRadius: 10,
      background: T.amberBg, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 12,
    }}>
      <span style={{ flex: 1 }}>Saved draft differs from the published page: {parts.join("; ")}. The page is what readers see.</span>
      <button style={{ ...btn(false), padding: "3px 8px", fontSize: 11 }} disabled={busy} onClick={onFix}>
        {busy ? "Syncing…" : "Make the draft match the page"}
      </button>
    </div>
  );
}

export default function PublishedJournalPhotos({ item, photos, onChanged }: {
  item: EngineItem; photos: EnginePhoto[]; onChanged: () => void;
}) {
  const [inventory, setInventory] = useState<PostImageInventory | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<"replace" | "remove" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInventory(await engineApi.liveJournalPhotos(item.id));
    } catch (err) {
      console.error("could not load live journal photos", err);
      setNotice(err instanceof Error ? err.message : "could not load the post's photos");
    }
  }, [item.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not update the post");
    } finally {
      setBusy(null);
    }
  };

  const remove = (photo: LiveJournalPhoto) => {
    const name = photo.filename ?? "this photo";
    if (!confirm(`Remove ${name} from the published post? The original file stays in the library.`)) return;
    void run(photo.url, async () => {
      const r = await engineApi.removeJournalPhoto(item.id, photo.url);
      return `Removed ${name} — ${r.remaining} gallery photo${r.remaining === 1 ? "" : "s"} left.`;
    });
  };

  const pickCover = (url: string) => {
    const keepOld = picker === "replace";
    setPicker(null);
    void run("cover", async () => {
      await engineApi.replaceJournalCover(item.id, url, keepOld);
      return keepOld ? "Cover replaced — the old cover is now in the gallery." : "Cover replaced — the old cover left the post.";
    });
  };

  const live = inventory?.photos ?? [];
  const tiles = live.filter((p) => p.role !== "og");
  const liveIds = new Set(live.flatMap((p) => (p.photoId ? [p.photoId] : [])));
  const hidden = tiles.filter((p) => p.excludedInLibrary || !p.photoId).length;
  const ok = notice !== null && /^(Removed|Cover replaced|Draft)/.test(notice);

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={label}>Published images ({inventory ? tiles.length : "…"}) — what the page renders</span>
        {hidden > 0 && (
          <span style={{ fontSize: 11, color: T.amber }}>
            {hidden} photo{hidden === 1 ? " is" : "s are"} excluded or unmatched in the library but still published
          </span>
        )}
      </div>
      {inventory && <DriftWarning inventory={inventory} busy={busy === "sync"}
        onFix={() => void run("sync", async () => { await engineApi.syncJournalPayload(item.id); return "Draft now matches the page."; })} />}
      {inventory && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))", gap: 8 }}>
          {tiles.map((p, i) => (
            <PhotoTile key={`${p.url}-${i}`} photo={p} busy={busy !== null}
              onRemove={() => remove(p)} onReplaceCover={() => setPicker("replace")} onRemoveCover={() => setPicker("remove")} />
          ))}
        </div>
      )}
      <SocialImageRow live={live} />
      {notice && <p style={{ fontSize: 12, margin: 0, color: ok ? T.inkSoft : T.red }}>{notice}</p>}
      {inventory && (
        <AddJournalPhotos item={item} photos={photos} livePhotoIds={liveIds}
          onChanged={() => { void load(); onChanged(); }} />
      )}
      {inventory && <PostRevisions postId={inventory.postId} onRestored={() => { void load(); onChanged(); }} />}
      {picker && (
        <CoverPicker mode={picker} candidates={coverCandidates(live, photos)} busy={busy === "cover"}
          onPick={pickCover} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
