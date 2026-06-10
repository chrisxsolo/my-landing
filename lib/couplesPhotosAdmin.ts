// lib/couplesPhotosAdmin.ts
// Shared constants + validation for couples-guide photo administration. No server
// or Next imports, so it's safe to import from both the admin client tab and the
// server-only API route (and unit-testable). All writes happen through the admin
// API route (requireAdmin + service role); this file only validates input.
// Mirrors lib/familyPhotosAdmin.ts.

import { COUPLES_LOCATIONS } from "@/lib/couplesGuide/locations";
import { locationDisplayName } from "@/lib/couplesGuide/types";

export const COUPLES_PHOTOS_BUCKET = "couples-photos";
export const COUPLES_LOCATION_PHOTOS_TABLE = "couples_location_photos";

export const MAX_COUPLES_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB (matches the bucket limit)
export const ALLOWED_COUPLES_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** Location choices for the admin dropdown (every location, published or not). */
export const COUPLES_PHOTO_LOCATION_OPTIONS = COUPLES_LOCATIONS.map((loc) => ({
  slug: loc.slug,
  label: locationDisplayName(loc),
  published: loc.published,
}));

const VALID_SLUGS = new Set(COUPLES_LOCATIONS.map((loc) => loc.slug));

export function isValidCouplesLocationSlug(slug: unknown): slug is string {
  return typeof slug === "string" && VALID_SLUGS.has(slug);
}

export type CouplesPhotoUploadCheck = { ok: true } | { ok: false; error: string };

export function validateCouplesPhotoFile(file: { type?: string; size?: number } | null): CouplesPhotoUploadCheck {
  if (!file) return { ok: false, error: "Choose an image to upload." };
  if (!file.type || !ALLOWED_COUPLES_PHOTO_TYPES.includes(file.type as typeof ALLOWED_COUPLES_PHOTO_TYPES[number])) {
    return { ok: false, error: "Image must be a JPEG, PNG, WebP, or AVIF file." };
  }
  if (typeof file.size === "number" && file.size > MAX_COUPLES_PHOTO_BYTES) {
    return { ok: false, error: "Image must be 10 MB or smaller." };
  }
  return { ok: true };
}

/** Alt text is required for accessibility + image SEO. */
export function validateAltText(alt: unknown): CouplesPhotoUploadCheck {
  if (typeof alt !== "string" || alt.trim().length === 0) {
    return { ok: false, error: "Descriptive alt text is required." };
  }
  if (alt.trim().length > 300) {
    return { ok: false, error: "Alt text is too long (max 300 characters)." };
  }
  return { ok: true };
}

/** Turn a filename into a safe storage object name. */
export function safeCouplesFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "couples-photo";
}
