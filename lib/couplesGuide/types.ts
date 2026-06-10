// lib/couplesGuide/types.ts
// Shared types for the public couples photography guide. All written, indexable
// content for the individual location pages lives in typed config objects (one
// file per location under ./locations) that satisfy CouplesLocationData. A single
// shared template (CouplesLocationTemplate) renders them, so adding a new location
// is a new config file + a registry entry — no duplicated page code.
//
// Photographs are NOT stored here. Galleries and hero images are uploaded by the
// admin into Supabase (couples_location_photos) and read by the server-rendered
// templates, so Chris can populate locations without code changes.
//
// This intentionally mirrors lib/familyGuide/types.ts so the two guides stay
// visually and structurally native to one another. The one couples-specific shift
// is `movementInteraction` (how the location supports walking/holding/close
// moments) in place of the family guide's child-focused section.

export interface CouplesLocationData {
  /** URL slug, e.g. "palace-of-fine-arts". Matches the route segment. */
  slug: string;
  /** Plain location name, e.g. "Palace of Fine Arts". */
  name: string;
  /** Display name with correct punctuation, e.g. "Lovers' Lane". Defaults to name. */
  displayName?: string;
  /** Page H1, e.g. "Palace of Fine Arts Couples Photography". */
  h1: string;
  /** City/neighborhood line, e.g. "Marina District, San Francisco". */
  area: string;
  /** Broad region label used on the hub card chip, e.g. "San Francisco". */
  region: string;

  /** SEO. canonicalPath is the relative path; metadataBase resolves it. */
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
  keywords: string[];
  /** When false, the location is excluded from the sitemap and is noindexed. */
  published: boolean;

  // ── Locations-hub card ──────────────────────────────────────────────────────
  /** Short visual description shown on the locations hub card. */
  cardSummary: string;
  /** "Best fit for" line (hub card + template info row). */
  bestFor: string;
  /** General lighting character (hub card + template info row). */
  lightingChar: string;
  /** General walking / environmental note (hub card + template info row). */
  accessNote: string;
  /** Alt text for the hero image / placeholder — describes what a hero would show. */
  heroAlt: string;

  // ── Hero ────────────────────────────────────────────────────────────────────
  /** Intro paragraph under the H1. */
  heroTagline: string;

  // ── Body sections (each an array of paragraphs) ──────────────────────────────
  whyItWorks: string[];
  photoVariety: string[];
  /** Optional bullet list of the kinds of photos available here. */
  photoVarietyList?: string[];
  bestTimeOfDay: string[];
  bestSeasons: string[];
  whatToWear: string[];
  /** How the location supports walking, holding hands, close moments, movement. */
  movementInteraction: string[];
  parkingArrival: string[];

  // ── Final CTA ────────────────────────────────────────────────────────────────
  ctaTitle: string;
  ctaBody: string;
}

/** Lightweight shape used by the locations hub grid and JSON-LD. */
export type CouplesLocationSummary = Pick<
  CouplesLocationData,
  | "slug"
  | "name"
  | "displayName"
  | "area"
  | "region"
  | "cardSummary"
  | "bestFor"
  | "lightingChar"
  | "accessNote"
  | "heroAlt"
  | "canonicalPath"
>;

/** The display name with punctuation, falling back to the plain name. */
export function locationDisplayName(loc: Pick<CouplesLocationData, "name" | "displayName">) {
  return loc.displayName ?? loc.name;
}
