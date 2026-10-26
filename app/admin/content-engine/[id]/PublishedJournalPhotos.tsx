"use client";
// Every photo the LIVE journal post shows, read from the published row itself
// (not the engine's selection), so the editor and the page can't disagree.
// Each photo can be removed from the post — that drops only this post's
// association; the file and the session photo stay. Photos excluded from the
// library later, or added outside the engine, still appear here.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { EngineItem, EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import type { LiveJournalPhoto } from "@/lib/contentEngine/journalPhotoMembership";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import AddJournalPhotos from "./AddJournalPhotos";
import { btn, chip } from "./ui";

const THUMB_WIDTH = 256;

function PhotoTile({ photo, busy, onRemove }: {
  photo: LiveJournalPhoto; busy: boolean; onRemove: () => void;
}) {
  const isCover = photo.role === "cover";
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
          {isCover ? "Live · cover" : "Live"}
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
          <span style={{ fontSize: 10, color: T.inkFaint }}>excluded in library, still live</span>
        )}
        <button style={{ ...btn(false, !isCover), padding: "3px 8px", fontSize: 11 }}
          disabled={busy || isCover} onClick={onRemove}
          title={isCover ? "The cover can't be removed from the gallery" : "Remove from this post only"}>
          {isCover ? "Cover" : busy ? "Removing…" : "Remove from post"}
        </button>
      </div>
    </div>
  );
}

export default function PublishedJournalPhotos({ item, photos, onChanged }: {
  item: EngineItem; photos: EnginePhoto[]; onChanged: () => void;
}) {
  const [live, setLive] = useState<LiveJournalPhoto[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLive((await engineApi.liveJournalPhotos(item.id)).photos);
    } catch (err) {
      console.error("could not load live journal photos", err);
      setNotice(err instanceof Error ? err.message : "could not load the post's photos");
    }
  }, [item.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (photo: LiveJournalPhoto) => {
    const name = photo.filename ?? "this photo";
    if (!confirm(`Remove ${name} from the live post? The original file stays in the library.`)) return;
    setBusyUrl(photo.url);
    setNotice(null);
    try {
      const r = await engineApi.removeJournalPhoto(item.id, photo.url);
      setNotice(`Removed ${name} — ${r.remaining} gallery photo${r.remaining === 1 ? "" : "s"} left.`);
      await load();
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not remove the photo");
    } finally {
      setBusyUrl(null);
    }
  };

  const liveIds = new Set((live ?? []).flatMap((p) => (p.photoId ? [p.photoId] : [])));
  const hidden = (live ?? []).filter((p) => p.excludedInLibrary || !p.photoId).length;

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn(false)} onClick={() => setOpen((o) => !o)} disabled={live === null}>
          {open ? "Hide live photos" : `Manage live photos (${live?.length ?? "…"})`}
        </button>
        {hidden > 0 && !open && (
          <span style={{ fontSize: 11, color: T.amber }}>
            {hidden} live photo{hidden === 1 ? " is" : "s are"} excluded or unmatched in the library
          </span>
        )}
      </div>
      {open && live && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))", gap: 8 }}>
          {live.map((p, i) => (
            <PhotoTile key={`${p.url}-${i}`} photo={p} busy={busyUrl === p.url}
              onRemove={() => void remove(p)} />
          ))}
        </div>
      )}
      {notice && (
        <p style={{ fontSize: 12, margin: 0, color: notice.startsWith("Removed") ? T.inkSoft : T.red }}>{notice}</p>
      )}
      {live && (
        <AddJournalPhotos item={item} photos={photos} livePhotoIds={liveIds}
          onChanged={() => { void load(); onChanged(); }} />
      )}
    </div>
  );
}
