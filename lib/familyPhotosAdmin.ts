// lib/familyPhotosAdmin.ts
// Shared constants + validation for family-guide photo administration. No server
// or Next imports, so it's safe to import from both the admin client tab and the
// server-only API route (and unit-testable). All writes happen through the admin
// API route (requireAdmin + service role); this file only validates input.
// Generic validation lives in lib/photoAdminShared.ts; this module re-exports it
// under the family-specific names its call sites already use.

import { FAMILY_LOCATIONS } from "@/lib/familyGuide/locations";
import { locationDisplayName } from "@/lib/familyGuide/types";
import {
  MAX_ADMIN_PHOTO_BYTES,
  ALLOWED_ADMIN_PHOTO_TYPES,
  validateAdminPhotoFile,
  validatePhotoAltText,
  safePhotoFileName,
  type PhotoUploadCheck,
} from "@/lib/photoAdminShared";

export const FAMILY_PHOTOS_BUCKET = "family-photos";
export const FAMILY_LOCATION_PHOTOS_TABLE = "family_location_photos";

export const MAX_FAMILY_PHOTO_BYTES = MAX_ADMIN_PHOTO_BYTES;
export const ALLOWED_FAMILY_PHOTO_TYPES = ALLOWED_ADMIN_PHOTO_TYPES;

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

export type FamilyPhotoUploadCheck = PhotoUploadCheck;

export const validateFamilyPhotoFile = validateAdminPhotoFile;
export const validateAltText = validatePhotoAltText;

export function safeFamilyFileName(fileName: string) {
  return safePhotoFileName(fileName, "family-photo");
}
