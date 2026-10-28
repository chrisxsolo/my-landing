// Browser side of a photo upload: shrink → sign → upload straight to Supabase
// Storage → finalize, several files at once, each step retried on transient
// failures.
//
// Shrinking first is the big win. The server never keeps more than a
// 5000px-long-edge original (NORMALIZE_MAX_DIMENSION) — anything larger used
// to be uploaded in full, downloaded again by the finalize route, re-encoded
// and re-uploaded. Doing that resize here sends a fraction of the bytes for
// the same stored result. The photographer's own files are only read, never
// changed. The server still verifies every upload and still normalizes
// anything that arrives oversized, so a file this step leaves alone (PNG, WebP,
// rotated JPEG, or anything the browser can't decode) behaves exactly as before.
import { supabase } from "@/lib/supabase";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import { createLimiter, mapWithConcurrency } from "@/lib/contentEngine/concurrency";
import { readJpegOrientation } from "@/lib/contentEngine/jpegOrientation";
import { readJpegGps, type GpsCoordinates } from "@/lib/contentEngine/exifGps";
import { withRetries, type RetryPolicy } from "@/lib/contentEngine/retry";

// Must match ALLOWED_UPLOAD_MIME / NORMALIZE_MAX_DIMENSION / NORMALIZE_TRIGGER_BYTES
// in lib/contentEngine/uploadConfig.ts (that module pulls in node:crypto, so a
// client module can't import it). tests/unit/photoUpload.test.ts pins them.
export const ALLOWED_MIME: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const UPLOAD_MAX_EDGE = 5000;
export const UPLOAD_REENCODE_BYTES = 25 * 1024 * 1024;

// Six in flight keeps a 20-50 photo drop network-bound once files are small;
// decoding is capped separately because a 61MP decode holds ~250MB of pixels.
export const UPLOAD_CONCURRENCY = 6;
const DECODE_CONCURRENCY = 2;
const JPEG_QUALITY = 0.9;
// Below this a file is sent as-is: re-encoding costs more time than it saves.
const RESIZE_MIN_BYTES = 6 * 1024 * 1024;
const HEADER_BYTES = 256 * 1024;
const UPLOAD_RETRY: RetryPolicy = { attempts: 3, baseDelayMs: 800, maxDelayMs: 4_000 };

export interface PreparedUpload {
  blob: Blob;
  mime: string;
  resized: boolean;
  /** Read from the ORIGINAL before any resize drops EXIF — location evidence only. */
  gps: GpsCoordinates | null;
}

/** Target size when the long edge exceeds `maxEdge`, else null. */
export function scaleToFit(width: number, height: number, maxEdge: number): { width: number; height: number } | null {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge || longEdge <= 0) return null;
  const scale = maxEdge / longEdge;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function encodeJpeg(bitmap: ImageBitmap, width: number, height: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", JPEG_QUALITY));
}

/** Shrinks a large upright JPEG to the stored size; anything else passes through untouched. */
export async function prepareForUpload(file: File): Promise<PreparedUpload> {
  if (file.type !== "image/jpeg") return { blob: file, mime: file.type, resized: false, gps: null };
  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const original: PreparedUpload = { blob: file, mime: file.type, resized: false, gps: readJpegGps(header) };
  if (file.size < RESIZE_MIN_BYTES) return original;
  // A canvas re-encode drops EXIF; only an upright file is safe to re-encode.
  if (readJpegOrientation(header) !== 1) return original;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return original; // let the server's verification judge it
  }
  try {
    const target = scaleToFit(bitmap.width, bitmap.height, UPLOAD_MAX_EDGE);
    if (!target && file.size <= UPLOAD_REENCODE_BYTES) return original;
    const size = target ?? { width: bitmap.width, height: bitmap.height };
    const blob = await encodeJpeg(bitmap, size.width, size.height);
    return blob.size < file.size ? { ...original, blob, mime: "image/jpeg", resized: true } : original;
  } catch (err) {
    console.warn(`could not resize ${file.name}; uploading the original`, err);
    return original;
  } finally {
    bitmap.close();
  }
}

/** Network drops, timeouts, 429 and 5xx are worth another try; a 4xx verdict is not. */
export function isTransientUploadError(err: unknown): boolean {
  if (err instanceof EngineApiError) return err.status === 408 || err.status === 429 || err.status >= 500;
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status === 408 || status === 429 || status >= 500;
  return true; // fetch TypeError / unknown storage error: the network, not the file
}

const alreadyStored = (err: unknown) =>
  /already exists|duplicate/i.test(err instanceof Error ? err.message : String(err))
  || (err as { statusCode?: unknown } | null)?.statusCode === "409";

/** Uploaded, but the session's location could not be applied — said with the upload, never hidden. */
function locationWarning(file: File, sync: { failed: number; error: string | null } | undefined): string | null {
  if (!sync || sync.failed === 0) return null;
  return `${file.name}: uploaded, but the session location could not be applied (${sync.error ?? "sync failed"}) — Save facts to retry`;
}

/** Resolves to a warning when the photo landed without its session location. */
async function uploadPrepared(sessionId: string, file: File, prepared: PreparedUpload): Promise<string | null> {
  const retry = { policy: UPLOAD_RETRY, isRetryable: isTransientUploadError };
  const signed = await withRetries(
    () => engineApi.signUpload(sessionId, { mime: prepared.mime, sizeBytes: prepared.blob.size }), retry);
  await withRetries(async (attempt) => {
    const { error } = await supabase.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, prepared.blob, { contentType: prepared.mime });
    // A retry after a lost response finds the object already there: that is success.
    if (error && !(attempt > 1 && alreadyStored(error))) throw error;
  }, retry);
  return withRetries(async (attempt) => {
    try {
      const { locationSync } = await engineApi.finalizeUpload(sessionId, signed.path, {
        filename: file.name, mime: prepared.mime, sizeBytes: prepared.blob.size, gps: prepared.gps,
      });
      return locationWarning(file, locationSync);
    } catch (err) {
      // Same idea: a retried finalize that hits 409 means the first one landed.
      if (attempt > 1 && err instanceof EngineApiError && err.status === 409) return null;
      throw err;
    }
  }, retry);
}

export interface UploadProgress {
  total: number;
  done: number;
  failed: number;
  active: number;
  /** Bytes of the files as selected, and bytes actually sent so far. */
  originalBytes: number;
  sentBytes: number;
  startedAt: number;
  /** When this snapshot was taken — elapsed time without reading the clock in render. */
  updatedAt: number;
}

export interface UploadSummary extends UploadProgress {
  problems: string[];
  finishedAt: number;
}

export async function uploadPhotos(
  sessionId: string, files: File[], onProgress: (p: UploadProgress) => void,
): Promise<UploadSummary> {
  const decode = createLimiter(DECODE_CONCURRENCY);
  const progress: UploadProgress = {
    total: files.length, done: 0, failed: 0, active: 0,
    originalBytes: files.reduce((sum, f) => sum + f.size, 0), sentBytes: 0,
    startedAt: Date.now(), updatedAt: Date.now(),
  };
  const report = () => onProgress({ ...progress, updatedAt: Date.now() });
  report();

  const problems = await mapWithConcurrency(files, UPLOAD_CONCURRENCY, async (file) => {
    progress.active += 1;
    report();
    try {
      const prepared = await decode(() => prepareForUpload(file));
      const warning = await uploadPrepared(sessionId, file, prepared);
      progress.sentBytes += prepared.blob.size;
      progress.done += 1;
      return warning;
    } catch (err) {
      if (err instanceof EngineApiError && err.status === 409) {
        progress.done += 1; // already in this session — nothing lost
        return `${file.name}: already uploaded (duplicate photo)`;
      }
      progress.failed += 1;
      return `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`;
    } finally {
      progress.active -= 1;
      report();
    }
  });
  return { ...progress, problems: problems.filter((p): p is string => p !== null), finishedAt: Date.now() };
}
