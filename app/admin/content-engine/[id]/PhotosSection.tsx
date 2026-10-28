"use client";
// Section 2 — Photos (spec §7.4): drag/drop or picker upload (photoUpload.ts:
// shrink in the browser → sign → upload straight to Storage → finalize, where
// the server hash stays authoritative), grid of 1h signed thumbnails with
// analysis-status chips, Exclude toggle, and the Analyze run (photos analyzed
// in parallel server-side; Resume = same button). While analysis runs, chips
// and counts update from a light status poll — never a full refetch, which
// would re-sign every thumbnail.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { EnginePhoto, PhotoStatusRow } from "@/app/admin/content-engine/engineTypes";
import { analyzeAllPhotos, mergePhotoStatuses } from "@/app/admin/content-engine/pipeline";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import { formatDuration } from "@/lib/contentEngine/jobProgress";
import { btn, card, chip, sectionTitle } from "./ui";
import AnalysisProgress from "./AnalysisProgress";
import { filesFromEntry } from "./dropEntries";
import { ALLOWED_MIME, uploadPhotos, type UploadProgress } from "./photoUpload";
import SelectionBar from "./SelectionBar";
import TagStatusBadge from "@/app/admin/photoTagging/TagStatusBadge";
import { enginePhotoKey } from "@/lib/photoTagging/types";
import PhotoTaggingPanel, { useSessionTagging } from "./PhotoTaggingPanel";

interface Props {
  sessionId: string;
  photos: EnginePhoto[];
  aiAllowed: boolean;
  onChanged: () => void;
  // Local-state updater for changes that don't need a full workspace refetch —
  // a refetch re-signs every thumbnail URL, forcing the browser to reload the
  // whole grid (the old exclude-click slowness).
  onPhotosMutated: (updater: (prev: EnginePhoto[]) => EnginePhoto[]) => void;
  /** Changes when the session's school / location / service change (tag badges refresh). */
  factsKey: string;
}

// Tap zone around the 22px selected check (the visual stays small).
const CHECK_TAP_ZONE = 32;
const STATUS_CHIP: Record<EnginePhoto["analysis_status"], { label: string; color: string }> = {
  pending: { label: "pending", color: T.inkSoft },
  processing: { label: "processing…", color: T.blue },
  completed: { label: "✓ analyzed", color: T.green },
  failed: { label: "failed", color: T.red },
  skipped: { label: "skipped", color: T.inkFaint },
};

const MAX_NOTICE_ITEMS = 3;
const STATUS_POLL_MS = 2_000;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

function uploadLabel(p: UploadProgress): string {
  const parts = [`Uploading ${p.done} of ${p.total}`];
  if (p.active > 0) parts.push(`${p.active} in progress`);
  if (p.failed > 0) parts.push(`${p.failed} failed`);
  return parts.join(" · ");
}

export default function PhotosSection({ sessionId, photos, aiAllowed, onChanged, onPhotosMutated, factsKey }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<UploadProgress | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [curating, setCurating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // marker: the server's run marker (filters this run's photos); clickedAt: local time of the click.
  const [run, setRun] = useState<{
    marker: string | null; clickedAt: number; statuses: PhotoStatusRow[]; clockOffsetMs: number;
  } | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const tags = useSessionTagging(sessionId, factsKey);
  const [tagOpenId, setTagOpenId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const gridOrder = useMemo(() => photos.map((p) => p.id), [photos]);
  const taggableSelected = useMemo(() => [...selected].filter((id) => tags.byPhotoId.has(id)).length, [selected, tags.byPhotoId]);
  // The grid's signed thumbnails, by audit key, so the tag editor can show a private photo.
  const tagThumbs = useMemo(() => Object.fromEntries(photos.flatMap((p) =>
    (p.thumbnailUrl ? [[enginePhotoKey(p.id), p.thumbnailUrl]] : []))), [photos]);

  const uploadFiles = useCallback(async (incoming: File[]) => {
    if (!incoming.length) return;
    setNotice(null);
    setInfo(null);
    const files = incoming.filter((f) => ALLOWED_MIME.includes(f.type));
    const problems: string[] = [];
    if (files.length < incoming.length) {
      problems.push(`${incoming.length - files.length} file(s) skipped — JPEG, PNG, or WebP only`);
    }
    if (files.length > 0) {
      const summary = await uploadPhotos(sessionId, files, setUploading);
      problems.push(...summary.problems);
      const took = formatDuration(summary.finishedAt - summary.startedAt);
      setInfo(`${summary.done} of ${summary.total} photo(s) uploaded in ${took}`
        + (summary.sentBytes < summary.originalBytes * 0.9
          ? ` — sent ${mb(summary.sentBytes)} instead of ${mb(summary.originalBytes)}`
          : ""));
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

  // While analysis runs, follow each photo's status without refetching the grid.
  useEffect(() => {
    if (!analyzing) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { photoStatuses, serverNow } = await engineApi.getRun(sessionId);
        if (cancelled) return;
        onPhotosMutated((prev) => mergePhotoStatuses(prev, photoStatuses));
        setRun((r) => r && { ...r, statuses: photoStatuses, clockOffsetMs: serverNow - Date.now() });
      } catch {
        // transient; the next poll tries again
      }
    };
    const timer = setInterval(() => void poll(), STATUS_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [analyzing, sessionId, onPhotosMutated]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setNotice(null);
    setInfo(null);
    setRun({ marker: null, clickedAt: Date.now(), statuses: [], clockOffsetMs: 0 });
    let clean = false;
    try {
      // Photos run in parallel on the server; each round returns when its
      // claim window closes and the next round picks up what is left.
      const result = await analyzeAllPhotos(sessionId, {
        onRunStarted: (marker) => setRun((r) => r && { ...r, marker }),
      });
      if (result.failed > 0) {
        setNotice(`${result.failed} photo(s) failed analysis${result.errors[0] ? ` (${result.errors[0]})` : ""} — retry below`);
      } else {
        clean = true;
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "analysis failed");
    } finally {
      setAnalyzing(false);
      setRun(null);
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
      setBulkOpen(false);
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
            {uploading ? `Uploading ${uploading.done} of ${uploading.total}…` : "Upload photos"}
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
      {analyzing && run && run.statuses.length > 0 && (
        <AnalysisProgress statuses={run.statuses} runStartedAt={run.marker}
          startedAtMs={run.clickedAt + run.clockOffsetMs} clockOffsetMs={run.clockOffsetMs} live />
      )}
      {uploading && (
        <p style={{ fontSize: 13, color: T.blue }}>
          {uploadLabel(uploading)} · {formatDuration(uploading.updatedAt - uploading.startedAt)}
        </p>
      )}
      {notice && <p style={{ fontSize: 13, color: T.red }}>{notice}</p>}
      {info && <p style={{ fontSize: 13, color: T.green }}>{info}</p>}
      <input ref={fileInput} type="file" accept={ALLOWED_MIME.join(",")} multiple hidden
        onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))} />

      {photos.length > 0 && (selected.size > 0 ? (
        <SelectionBar count={selected.size} taggable={taggableSelected} deleting={deleting}
          onTag={() => setBulkOpen(true)}
          onSelectAll={() => setSelected(new Set(photos.map((p) => p.id)))}
          onClear={() => { setSelected(new Set()); setBulkOpen(false); }}
          onDelete={() => void deleteSelected()} />
      ) : (
        <p style={{ fontSize: 12, color: T.inkFaint, margin: "10px 0 0" }}>
          Click a photo to select it (to tag or delete). Click its colored dot for its tags.
        </p>
      ))}

      {photos.length > 0 && (
        <PhotoTaggingPanel state={tags} selectedIds={selected} gridOrder={gridOrder} openId={tagOpenId} thumbs={tagThumbs}
          onClose={() => setTagOpenId(null)} onClearSelection={() => setSelected(new Set())}
          bulkOpen={bulkOpen && selected.size > 0} onBulkClose={() => setBulkOpen(false)} />
      )}

      {photos.length === 0 ? (
        <p style={{ color: T.inkSoft, textAlign: "center", padding: 24 }}>
          No photos uploaded — drop files or a folder here, or use Upload photos.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
          {photos.filter((photo) => tags.passes(photo.id)).map((photo) => {
            const status = STATUS_CHIP[photo.analysis_status];
            const isSelected = selected.has(photo.id);
            return (
              <figure key={photo.id} style={{
                margin: 0, opacity: photo.excluded && !isSelected ? 0.4 : 1,
                border: `1px solid ${isSelected ? T.red : T.border}`, borderRadius: 10, overflow: "hidden",
                boxShadow: isSelected ? `0 0 0 2px ${T.redBorder}` : undefined,
              }}>
                <div onClick={() => toggleSelected(photo.id)} title="Click to select"
                  style={{ position: "relative", cursor: "pointer" }}>
                  {photo.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
                    <img src={photo.thumbnailUrl} alt={photo.alt_text ?? photo.original_filename ?? "session photo"}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ aspectRatio: "1", background: T.inset }} />
                  )}
                  <TagStatusBadge photo={tags.byPhotoId.get(photo.id)} compact onClick={() => setTagOpenId(photo.id)}
                    style={{ position: "absolute", top: 6, left: 6 }} />
                  {isSelected && (
                    // A 32px tap zone around the small check, so a thumb can hit it.
                    <span aria-label="Selected" style={{
                      position: "absolute", top: 0, right: 0, width: CHECK_TAP_ZONE, height: CHECK_TAP_ZONE,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        width: 22, height: 22, background: T.red, color: T.page, borderRadius: 999,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800,
                      }}>✓</span>
                    </span>
                  )}
                </div>
                <figcaption style={{ padding: "2px 6px", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={chip(status.color, T.inset)} title={photo.analysis_error ?? undefined}>
                    {status.label}{photo.quality_score ? ` · ${photo.quality_score}` : ""}
                  </span>
                  <button style={{ ...btn(false), padding: "0 10px", fontSize: 11 }}
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
