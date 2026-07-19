"use client";
// Section 2 — Photos (spec §7.4): drag/drop or picker upload through
// sign → uploadToSignedUrl → finalize (server hash is authoritative), grid of
// 1h signed thumbnails with analysis-status chips, Exclude toggle, and the
// client-orchestrated analyze loop (one batch per call; Resume = same button).
import { useCallback, useRef, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { supabase } from "@/lib/supabase";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import { btn, card, chip, sectionTitle } from "./ui";

interface Props {
  sessionId: string;
  photos: EnginePhoto[];
  aiAllowed: boolean;
  onChanged: () => void;
  // Local-state updater for changes that don't need a full workspace refetch —
  // a refetch re-signs every thumbnail URL, forcing the browser to reload the
  // whole grid (the old exclude-click slowness).
  onPhotosMutated: (updater: (prev: EnginePhoto[]) => EnginePhoto[]) => void;
}

const STATUS_CHIP: Record<EnginePhoto["analysis_status"], { label: string; color: string }> = {
  pending: { label: "pending", color: T.inkSoft },
  processing: { label: "processing…", color: T.blue },
  completed: { label: "✓ analyzed", color: T.green },
  failed: { label: "failed", color: T.red },
  skipped: { label: "skipped", color: T.inkFaint },
};

// Must match ALLOWED_UPLOAD_MIME in lib/contentEngine/uploadConfig.ts (that
// module pulls in node:crypto, so it can't be imported into a client component).
const ALLOWED_MIME: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
const MAX_NOTICE_ITEMS = 3;

// readEntries() returns at most ~100 entries per call; drain until empty.
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const step = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        step();
      }, reject);
    step();
  });
}

async function filesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) =>
      (entry as FileSystemFileEntry).file((file) => resolve([file]), reject),
    );
  }
  if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    return (await Promise.all(children.map(filesFromEntry))).flat();
  }
  return [];
}

export default function PhotosSection({ sessionId, photos, aiAllowed, onChanged, onPhotosMutated }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [curating, setCurating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const uploadFiles = useCallback(async (incoming: File[]) => {
    if (!incoming.length) return;
    setNotice(null);
    const files = incoming.filter((f) => ALLOWED_MIME.includes(f.type));
    const problems: string[] = [];
    if (files.length < incoming.length) {
      problems.push(`${incoming.length - files.length} file(s) skipped — JPEG, PNG, or WebP only`);
    }
    for (const file of files) {
      setUploading(file.name);
      try {
        const signed = await engineApi.signUpload(sessionId, { mime: file.type, sizeBytes: file.size });
        const { error } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
        if (error) throw new Error(`upload failed: ${error.message}`);
        await engineApi.finalizeUpload(sessionId, signed.path, {
          filename: file.name, mime: file.type, sizeBytes: file.size,
        });
      } catch (err) {
        if (err instanceof EngineApiError && err.status === 409) {
          problems.push(`${file.name}: already uploaded (duplicate photo)`);
        } else {
          problems.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        }
      }
    }
    setUploading(null);
    if (problems.length > 0) {
      const extra = problems.length - MAX_NOTICE_ITEMS;
      setNotice(problems.slice(0, MAX_NOTICE_ITEMS).join(" · ") + (extra > 0 ? ` · +${extra} more` : ""));
    }
    onChanged();
  }, [sessionId, onChanged]);

  const handleDrop = useCallback(async (dt: DataTransfer) => {
    // webkitGetAsEntry() only works synchronously inside the drop event, so
    // entries are captured before the first await. Folders arrive in
    // dataTransfer.files as a single extensionless pseudo-file — the entry API
    // is the only way to reach the images inside them.
    const entries = Array.from(dt.items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null);
    if (entries.length === 0) return uploadFiles(Array.from(dt.files));
    try {
      const files = (await Promise.all(entries.map(filesFromEntry))).flat();
      await uploadFiles(files);
    } catch (err) {
      console.error("reading dropped folder failed", err);
      setNotice("could not read the dropped folder — try Upload photos instead");
    }
  }, [uploadFiles]);

  const pendingCount = photos.filter((p) => !p.excluded
    && (p.analysis_status === "pending" || p.analysis_status === "failed")).length;
  const failedCount = photos.filter((p) => !p.excluded && p.analysis_status === "failed").length;
  const includedCount = photos.filter((p) => !p.excluded).length;
  const analyzedCount = photos.filter((p) => !p.excluded && p.analysis_status === "completed").length;
  // Big shoots: after a clean analysis run, AI narrows the set to the top picks
  const autoCurate = includedCount >= AUTO_CURATE_THRESHOLD;

  const runCuration = useCallback(async () => {
    setCurating(true);
    setNotice(null);
    setInfo(null);
    try {
      const result = await engineApi.curatePhotos(sessionId);
      setInfo(result.curated
        ? `AI kept the best ${result.picked} of ${result.total} photos — ${result.excluded} excluded (click Include on any photo to bring it back)`
        : `Only ${result.total} analyzed photo(s) — already at or under ${TOP_PICK_COUNT}, nothing excluded`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "curation failed");
    } finally {
      setCurating(false);
      onChanged();
    }
  }, [sessionId, onChanged]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setNotice(null);
    setInfo(null);
    let clean = false;
    try {
      // client orchestrates: one batch per request until none remain (spec §8.1)
      for (;;) {
        const result = await engineApi.analyzeBatch(sessionId);
        onChanged();
        if (result.failed > 0) {
          setNotice(`${result.failed} photo(s) failed analysis — fix or retry below`);
          break;
        }
        if (result.remaining === 0) { clean = true; break; }
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "analysis failed");
    } finally {
      setAnalyzing(false);
      onChanged();
    }
    if (clean && autoCurate) await runCuration();
  }, [sessionId, onChanged, autoCurate, runCuration]);

  // Optimistic: flip locally right away, revert on server failure. No full
  // refetch — that would re-sign and reload every thumbnail in the grid.
  const toggleExcluded = useCallback(async (photo: EnginePhoto) => {
    const next = !photo.excluded;
    onPhotosMutated((prev) => prev.map((p) => (p.id === photo.id ? { ...p, excluded: next } : p)));
    try {
      await engineApi.patchPhoto(photo.id, { excluded: next });
    } catch (err) {
      onPhotosMutated((prev) => prev.map((p) => (p.id === photo.id ? { ...p, excluded: photo.excluded } : p)));
      setNotice(err instanceof Error ? err.message : "update failed");
    }
  }, [onPhotosMutated]);

  const toggleSelected = useCallback((photoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }, []);

  const deleteSelected = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    if (!confirm(`Permanently delete ${ids.length} photo(s)? Originals are removed from storage — this cannot be undone.`)) return;
    setDeleting(true);
    setNotice(null);
    try {
      const result = await engineApi.deletePhotos(sessionId, ids);
      const gone = new Set(result.deleted);
      onPhotosMutated((prev) => prev.filter((p) => !gone.has(p.id)));
      setSelected(new Set());
      if (result.skippedPublished.length > 0) {
        setNotice(`${result.skippedPublished.length} photo(s) not deleted — already published (take down first)`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "delete failed");
    } finally {
      setDeleting(false);
    }
  }, [selected, deleting, sessionId, onPhotosMutated]);

  return (
    <section style={card}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void handleDrop(e.dataTransfer); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>Photos ({photos.length})</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(false)} onClick={() => fileInput.current?.click()} disabled={uploading !== null}>
            {uploading ? `Uploading ${uploading}…` : "Upload photos"}
          </button>
          {analyzedCount > TOP_PICK_COUNT && (
            <button style={btn(false)} disabled={!aiAllowed || analyzing || curating}
              onClick={() => void runCuration()}
              title="One AI pass ranks the analyzed photos and excludes all but the strongest">
              {curating ? "Picking…" : `AI pick top ${TOP_PICK_COUNT}`}
            </button>
          )}
          <button style={btn(true)} disabled={!aiAllowed || analyzing || curating || pendingCount === 0}
            onClick={() => void runAnalysis()}
            title={!aiAllowed ? "Enable AI processing above to analyze" : undefined}>
            {analyzing ? "Analyzing…" : failedCount > 0 ? `Retry failed (${failedCount})` : `Analyze ${pendingCount} photos`}
          </button>
        </div>
      </div>
      {!aiAllowed && (
        <p style={{ fontSize: 13, color: T.inkSoft }}>
          Analysis is disabled until AI processing is confirmed in Permissions.
        </p>
      )}
      {autoCurate && pendingCount > 0 && (
        <p style={{ fontSize: 13, color: T.inkSoft }}>
          {includedCount} photos included — after analysis, AI will keep the best {TOP_PICK_COUNT} and exclude the rest.
        </p>
      )}
      {notice && <p style={{ fontSize: 13, color: T.red }}>{notice}</p>}
      {info && <p style={{ fontSize: 13, color: T.green }}>{info}</p>}
      <input ref={fileInput} type="file" accept={ALLOWED_MIME.join(",")} multiple hidden
        onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))} />

      {photos.length > 0 && (selected.size > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{selected.size} selected</span>
          <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }}
            onClick={() => setSelected(new Set(photos.map((p) => p.id)))}>Select all</button>
          <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }}
            onClick={() => setSelected(new Set())}>Clear</button>
          <button style={{ ...btn(false, true), padding: "3px 10px", fontSize: 12 }} disabled={deleting}
            onClick={() => void deleteSelected()}>
            {deleting ? "Deleting…" : `Delete ${selected.size} photo(s)`}
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: T.inkFaint, margin: "10px 0 0" }}>
          Click a photo to select it for deletion.
        </p>
      ))}

      {photos.length === 0 ? (
        <p style={{ color: T.inkSoft, textAlign: "center", padding: 24 }}>
          No photos uploaded — drop files or a folder here, or use Upload photos.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
          {photos.map((photo) => {
            const status = STATUS_CHIP[photo.analysis_status];
            const isSelected = selected.has(photo.id);
            return (
              <figure key={photo.id} style={{
                margin: 0, opacity: photo.excluded && !isSelected ? 0.4 : 1,
                border: `1px solid ${isSelected ? T.red : T.border}`, borderRadius: 10, overflow: "hidden",
                boxShadow: isSelected ? `0 0 0 2px ${T.redBorder}` : undefined,
              }}>
                <div onClick={() => toggleSelected(photo.id)} title="Click to select for deletion"
                  style={{ position: "relative", cursor: "pointer" }}>
                  {photo.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
                    <img src={photo.thumbnailUrl} alt={photo.alt_text ?? photo.original_filename ?? "session photo"}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ aspectRatio: "1", background: T.inset }} />
                  )}
                  {isSelected && (
                    <span style={{
                      position: "absolute", top: 6, right: 6, width: 22, height: 22,
                      background: T.red, color: "#131114", borderRadius: 999,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800,
                    }}>✓</span>
                  )}
                </div>
                <figcaption style={{ padding: 6, fontSize: 11, display: "flex", justifyContent: "space-between", gap: 4 }}>
                  <span style={chip(status.color, T.inset)} title={photo.analysis_error ?? undefined}>
                    {status.label}{photo.quality_score ? ` · ${photo.quality_score}` : ""}
                  </span>
                  <button style={{ ...btn(false), padding: "0 6px", fontSize: 11 }}
                    onClick={() => void toggleExcluded(photo)}>
                    {photo.excluded ? "Include" : "Exclude"}
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
