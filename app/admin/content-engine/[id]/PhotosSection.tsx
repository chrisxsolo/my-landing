"use client";
// Section 2 — Photos (spec §7.4): drag/drop or picker upload through
// sign → uploadToSignedUrl → finalize (server hash is authoritative), grid of
// 1h signed thumbnails with analysis-status chips, Exclude toggle, and the
// client-orchestrated analyze loop (one batch per call; Resume = same button).
import { useCallback, useRef, useState } from "react";
import { C } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { btn, card, chip, sectionTitle } from "./ui";

interface Props {
  sessionId: string;
  photos: EnginePhoto[];
  aiAllowed: boolean;
  onChanged: () => void;
}

const STATUS_CHIP: Record<EnginePhoto["analysis_status"], { label: string; color: string }> = {
  pending: { label: "pending", color: C.muted },
  processing: { label: "processing…", color: C.ink },
  completed: { label: "✓ analyzed", color: C.ink },
  failed: { label: "failed", color: C.danger },
  skipped: { label: "skipped", color: C.muted },
};

export default function PhotosSection({ sessionId, photos, aiAllowed, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);
    for (const file of Array.from(files)) {
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
          setNotice(`${file.name}: already uploaded (duplicate photo)`);
        } else {
          setNotice(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        }
      }
    }
    setUploading(null);
    onChanged();
  }, [sessionId, onChanged]);

  const pendingCount = photos.filter((p) => !p.excluded
    && (p.analysis_status === "pending" || p.analysis_status === "failed")).length;
  const failedCount = photos.filter((p) => !p.excluded && p.analysis_status === "failed").length;

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setNotice(null);
    try {
      // client orchestrates: one batch per request until none remain (spec §8.1)
      for (;;) {
        const result = await engineApi.analyzeBatch(sessionId);
        onChanged();
        if (result.failed > 0) {
          setNotice(`${result.failed} photo(s) failed analysis — fix or retry below`);
          break;
        }
        if (result.remaining === 0) break;
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "analysis failed");
    } finally {
      setAnalyzing(false);
      onChanged();
    }
  }, [sessionId, onChanged]);

  const toggleExcluded = useCallback(async (photo: EnginePhoto) => {
    try {
      await engineApi.patchPhoto(photo.id, { excluded: !photo.excluded });
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "update failed");
    }
  }, [onChanged]);

  return (
    <section style={card}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void uploadFiles(e.dataTransfer.files); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitle}>Photos ({photos.length})</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(false)} onClick={() => fileInput.current?.click()} disabled={uploading !== null}>
            {uploading ? `Uploading ${uploading}…` : "Upload photos"}
          </button>
          <button style={btn(true)} disabled={!aiAllowed || analyzing || pendingCount === 0}
            onClick={() => void runAnalysis()}
            title={!aiAllowed ? "Enable AI processing above to analyze" : undefined}>
            {analyzing ? "Analyzing…" : failedCount > 0 ? `Retry failed (${failedCount})` : `Analyze ${pendingCount} photos`}
          </button>
        </div>
      </div>
      {!aiAllowed && (
        <p style={{ fontSize: 13, color: C.muted }}>
          Analysis is disabled until AI processing is confirmed in Permissions.
        </p>
      )}
      {notice && <p style={{ fontSize: 13, color: C.danger }}>{notice}</p>}
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => void uploadFiles(e.target.files)} />

      {photos.length === 0 ? (
        <p style={{ color: C.muted, textAlign: "center", padding: 24 }}>
          No photos uploaded — drop files here or use Upload photos.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
          {photos.map((photo) => {
            const status = STATUS_CHIP[photo.analysis_status];
            return (
              <figure key={photo.id} style={{
                margin: 0, opacity: photo.excluded ? 0.4 : 1,
                border: `1px solid ${C.warmEdge}`, borderRadius: 10, overflow: "hidden",
              }}>
                {photo.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
                  <img src={photo.thumbnailUrl} alt={photo.alt_text ?? photo.original_filename ?? "session photo"}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ aspectRatio: "1", background: C.pageAlt }} />
                )}
                <figcaption style={{ padding: 6, fontSize: 11, display: "flex", justifyContent: "space-between", gap: 4 }}>
                  <span style={chip(status.color, C.pageAlt)} title={photo.analysis_error ?? undefined}>
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
