// Upload trust-boundary configuration (spec §4.1, §4.2). The server OWNS the
// storage path: it issues originals/<sessionId>/<uuid>.<ext> and later verifies
// a finalized path matches that pattern for the same session.
import { randomUUID } from "node:crypto";

export const ORIGINALS_BUCKET = "session-content-originals";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB (spec §4.2)
export const MAX_IMAGE_PIXELS = 50_000_000;       // decompression-bomb guard (sharp limitInputPixels)
export const ALLOWED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];

const MIME_EXT: Record<AllowedUploadMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extForMime(mime: string): string | null {
  return MIME_EXT[mime as AllowedUploadMime] ?? null;
}

export function isAllowedMime(mime: string): mime is AllowedUploadMime {
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(mime);
}

export function issueUploadPath(sessionId: string, mime: string): string {
  const ext = extForMime(mime);
  if (!ext) throw new Error(`unsupported upload MIME: ${mime}`);
  return `originals/${sessionId}/${randomUUID()}.${ext}`;
}

// True only for a single-segment file directly under originals/<sessionId>/ with
// an allowed extension. Rejects traversal, nested paths, and foreign sessions.
//
// Security: the regex's [^/]+ segments cannot span '/', so
// originals/<s>/../<other>/x.jpg fails the three-segment match (it has 4 parts).
// The explicit base.includes("..") check is belt-and-braces for oddities like
// originals/<s>/..jpg that somehow pass segment counting.
export function isOwnedUploadPath(path: string, sessionId: string): boolean {
  const m = /^originals\/([^/]+)\/([^/]+)\.([a-z0-9]+)$/.exec(path);
  if (!m) return false;
  const [, pathSession, base, ext] = m;
  if (pathSession !== sessionId) return false;
  if (base.includes("..") || base.includes("/")) return false;
  return (Object.values(MIME_EXT) as string[]).includes(ext);
}
