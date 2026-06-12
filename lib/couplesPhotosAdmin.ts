// lib/couplesPhotosAdmin.ts
// Shared constants + validation for couples-guide photo administration. No server
// or Next imports, so it's safe to import from both the admin client tab and the
// server-only API route (and unit-testable). All writes happen through the admin
// API route (requireAdmin + service role); this file only validates input.
// Generic validation lives in lib/photoAdminShared.ts; this module re-exports it
// under the couples-specific names its call sites already use.

import { COUPLES_LOCATIONS } from "@/lib/couplesGuide/locations";
import { locationDisplayName } from "@/lib/couplesGuide/types";
import {
  MAX_ADMIN_PHOTO_BYTES,
  ALLOWED_ADMIN_PHOTO_TYPES,
  validateAdminPhotoFile,
  validatePhotoAltText,
  safePhotoFileName,
  type PhotoUploadCheck,
} from "@/lib/photoAdminShared";

export const COUPLES_PHOTOS_BUCKET = "couples-photos";
export const COUPLES_LOCATION_PHOTOS_TABLE = "couples_location_photos";

export const MAX_COUPLES_PHOTO_BYTES = MAX_ADMIN_PHOTO_BYTES;
export const ALLOWED_COUPLES_PHOTO_TYPES = ALLOWED_ADMIN_PHOTO_TYPES;

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

export type CouplesPhotoUploadCheck = PhotoUploadCheck;

export const validateCouplesPhotoFile = validateAdminPhotoFile;
export const validateAltText = validatePhotoAltText;

export function safeCouplesFileName(fileName: string) {
  return safePhotoFileName(fileName, "couples-photo");
}
