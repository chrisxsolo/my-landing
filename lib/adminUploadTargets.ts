// Server-side registry of admin photo-upload destinations. The browser uploads
// straight to Storage via a signed URL (app/api/admin/storage/sign), so file
// bytes never pass through a serverless function and large photos can't hit the
// ~4.5 MB request-body limit. Each target maps a key to its bucket and the rule
// for which path prefix (location slug / fact slug / folder) is allowed.

import { COUPLES_PHOTOS_BUCKET, isValidCouplesLocationSlug } from "@/lib/couplesPhotosAdmin";
import { FAMILY_PHOTOS_BUCKET, isValidFamilyLocationSlug } from "@/lib/familyPhotosAdmin";
import { ABOUT_PHOTOS_BUCKET, isValidAboutFactSlug } from "@/lib/aboutFacts";

export const GRAD_PHOTOS_BUCKET = "grad-photos";

// Folder prefixes the generic image uploader may write into. Keeps a prefix from
// being used for path traversal or to write outside known areas.
const GRAD_UPLOAD_FOLDERS = new Set([
  "locations",
  "poses",
  "bay-area-locations",
  "blog",
  "case-studies",
  "portfolio",
  "library",
]);

export type AdminUploadTarget = {
  bucket: string;
  isValidPrefix: (prefix: string) => boolean;
};

const TARGETS: Record<string, AdminUploadTarget> = {
  "couples-photos": { bucket: COUPLES_PHOTOS_BUCKET, isValidPrefix: isValidCouplesLocationSlug },
  "family-photos": { bucket: FAMILY_PHOTOS_BUCKET, isValidPrefix: isValidFamilyLocationSlug },
  "about-photos": { bucket: ABOUT_PHOTOS_BUCKET, isValidPrefix: isValidAboutFactSlug },
  "grad-image": { bucket: GRAD_PHOTOS_BUCKET, isValidPrefix: (prefix) => GRAD_UPLOAD_FOLDERS.has(prefix) },
};

export function getAdminUploadTarget(key: unknown): AdminUploadTarget | null {
  return typeof key === "string" ? TARGETS[key] ?? null : null;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

// The server owns the object name: <prefix>/<uuid>.<ext>. Throws on an
// unsupported mime so a bad type can't produce an extensionless path.
export function issueAdminUploadPath(prefix: string, mime: string): string {
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error("Upload a JPEG, PNG, WebP, or AVIF image.");
  return `${prefix}/${crypto.randomUUID()}.${ext}`;
}

const OBJECT_NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/i;

// True only when path is exactly <prefix>/<uuid>.<ext> — a server-issued name in
// the expected prefix. Rejects traversal, nested paths, and foreign prefixes, so
// a row can never be pointed at an arbitrary object the caller didn't just upload.
export function isOwnedAdminUploadPath(path: string, prefix: string): boolean {
  const head = `${prefix}/`;
  if (!path.startsWith(head)) return false;
  return OBJECT_NAME_RE.test(path.slice(head.length));
}
