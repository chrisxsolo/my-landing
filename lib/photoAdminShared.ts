// lib/photoAdminShared.ts
// Generic photo-upload validation shared by admin photo features (family guide,
// about page). No server or Next imports, so it's safe to import from client
// tabs, API routes, and unit tests alike.

export const MAX_ADMIN_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB (matches the bucket limits)
export const ALLOWED_ADMIN_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type PhotoUploadCheck = { ok: true } | { ok: false; error: string };

export function validateAdminPhotoFile(file: { type?: string; size?: number } | null): PhotoUploadCheck {
  if (!file) return { ok: false, error: "Choose an image to upload." };
  if (!file.type || !ALLOWED_ADMIN_PHOTO_TYPES.includes(file.type as typeof ALLOWED_ADMIN_PHOTO_TYPES[number])) {
    return { ok: false, error: "Image must be a JPEG, PNG, WebP, or AVIF file." };
  }
  if (typeof file.size === "number" && file.size > MAX_ADMIN_PHOTO_BYTES) {
    return { ok: false, error: "Image must be 10 MB or smaller." };
  }
  return { ok: true };
}

/** Alt text is required for accessibility + image SEO. */
export function validatePhotoAltText(alt: unknown): PhotoUploadCheck {
  if (typeof alt !== "string" || alt.trim().length === 0) {
    return { ok: false, error: "Descriptive alt text is required." };
  }
  if (alt.trim().length > 300) {
    return { ok: false, error: "Alt text is too long (max 300 characters)." };
  }
  return { ok: true };
}

/** Turn a filename into a safe storage object name. */
export function safePhotoFileName(fileName: string, fallback = "photo") {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || fallback;
}
