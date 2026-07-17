// lib/portraitPhotosAdmin.ts
// Shared constants + validation for portrait-guide photo administration. No server
// or Next imports, so it's safe to import from both the admin client tab and the
// server-only API route (and unit-testable). All writes happen through the admin
// API route (requireAdmin + service role); this file only validates input.
// Generic validation lives in lib/photoAdminShared.ts; this module re-exports it
// under the portrait-specific names its call sites use. Mirrors couplesPhotosAdmin.

import { PORTRAIT_LOCATIONS } from "@/lib/portraitGuide/locations";
import { locationDisplayName } from "@/lib/portraitGuide/types";
import {
  MAX_ADMIN_PHOTO_BYTES,
  ALLOWED_ADMIN_PHOTO_TYPES,
  validateAdminPhotoFile,
  validatePhotoAltText,
  safePhotoFileName,
  type PhotoUploadCheck,
} from "@/lib/photoAdminShared";

export const PORTRAIT_PHOTOS_BUCKET = "portrait-photos";
export const PORTRAIT_LOCATION_PHOTOS_TABLE = "portrait_location_photos";

export const MAX_PORTRAIT_PHOTO_BYTES = MAX_ADMIN_PHOTO_BYTES;
export const ALLOWED_PORTRAIT_PHOTO_TYPES = ALLOWED_ADMIN_PHOTO_TYPES;

/** Location choices for the admin dropdown (every location, published or not). */
export const PORTRAIT_PHOTO_LOCATION_OPTIONS = PORTRAIT_LOCATIONS.map((loc) => ({
  slug: loc.slug,
  label: locationDisplayName(loc),
  published: loc.published,
}));

const VALID_SLUGS = new Set(PORTRAIT_LOCATIONS.map((loc) => loc.slug));

export function isValidPortraitLocationSlug(slug: unknown): slug is string {
  return typeof slug === "string" && VALID_SLUGS.has(slug);
}

export type PortraitPhotoUploadCheck = PhotoUploadCheck;

export const validatePortraitPhotoFile = validateAdminPhotoFile;
export const validateAltText = validatePhotoAltText;

export function safePortraitFileName(fileName: string) {
  return safePhotoFileName(fileName, "portrait-photo");
}
