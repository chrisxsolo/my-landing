// lib/familyPhotosAdmin.ts
// Shared constants + validation for family-guide photo administration. No server
// or Next imports, so it's safe to import from both the admin client tab and the
// server-only API route (and unit-testable). All writes happen through the admin
// API route (requireAdmin + service role); this file only validates input.

import { FAMILY_LOCATIONS } from "@/lib/familyGuide/locations";
import { locationDisplayName } from "@/lib/familyGuide/types";

export const FAMILY_PHOTOS_BUCKET = "family-photos";
export const FAMILY_LOCATION_PHOTOS_TABLE = "family_location_photos";

export const MAX_FAMILY_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB (matches the bucket limit)
export const ALLOWED_FAMILY_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** Location choices for the admin dropdown (every location, published or not). */
export const FAMILY_PHOTO_LOCATION_OPTIONS = FAMILY_LOCATIONS.map((loc) => ({
  slug: loc.slug,
  label: locationDisplayName(loc),
  published: loc.published,
}));

const VALID_SLUGS = new Set(FAMILY_LOCATIONS.map((loc) => loc.slug));

export function isValidFamilyLocationSlug(slug: unknown): slug is string {
  return typeof slug === "string" && VALID_SLUGS.has(slug);
}

export type FamilyPhotoUploadCheck = { ok: true } | { ok: false; error: string };

export function validateFamilyPhotoFile(file: { type?: string; size?: number } | null): FamilyPhotoUploadCheck {
  if (!file) return { ok: false, error: "Choose an image to upload." };
  if (!file.type || !ALLOWED_FAMILY_PHOTO_TYPES.includes(file.type as typeof ALLOWED_FAMILY_PHOTO_TYPES[number])) {
    return { ok: false, error: "Image must be a JPEG, PNG, WebP, or AVIF file." };
  }
  if (typeof file.size === "number" && file.size > MAX_FAMILY_PHOTO_BYTES) {
    return { ok: false, error: "Image must be 10 MB or smaller." };
  }
  return { ok: true };
}

/** Alt text is required for accessibility + image SEO. */
export function validateAltText(alt: unknown): FamilyPhotoUploadCheck {
  if (typeof alt !== "string" || alt.trim().length === 0) {
    return { ok: false, error: "Descriptive alt text is required." };
  }
  if (alt.trim().length > 300) {
    return { ok: false, error: "Alt text is too long (max 300 characters)." };
  }
  return { ok: true };
}

/** Turn a filename into a safe storage object name. */
export function safeFamilyFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "family-photo";
}
