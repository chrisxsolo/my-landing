// lib/couplesGuide/locations/index.ts
// Registry of every couples-photo location. To add a future location (Baker Beach,
// Marshall's Beach, Presidio Tunnel Tops, Golden Gate Park, Lands End, Sutro Baths,
// Bernal Heights, Marin Headlands, Half Moon Bay, etc.):
//   1. Create a new ./<slug>.ts exporting a CouplesLocationData object.
//   2. Import it and add it to COUPLES_LOCATIONS below.
// The locations hub, the [slug] route (generateStaticParams), the sitemap, and the
// admin photo dropdown all read from here, so a new location appears everywhere
// automatically. Mirrors lib/familyGuide/locations/index.ts.

import type { CouplesLocationData, CouplesLocationSummary } from "@/lib/couplesGuide/types";
import palaceOfFineArts from "./palace-of-fine-arts";
import crissyField from "./crissy-field";
import loversLane from "./lovers-lane";
import legionOfHonor from "./legion-of-honor";
import oceanBeach from "./ocean-beach";

// Order here is the display order on the locations hub.
export const COUPLES_LOCATIONS: CouplesLocationData[] = [
  palaceOfFineArts,
  crissyField,
  loversLane,
  legionOfHonor,
  oceanBeach,
];

// Publishing model (per the "don't index thin pages" directive):
//   - Every location is LISTED on the hubs and REACHABLE by URL (the written copy
//     is genuinely useful), and is statically generated.
//   - `published` controls SEARCH visibility only: a location is added to the
//     sitemap and is indexable ONLY when published === true. Unpublished pages
//     render with a noindex robots tag and are kept out of the sitemap until they
//     have a credible set of photos. Flip `published: true` in the config to go live.

/** All locations — used for routing/static params and the hub listings. */
export function getAllCouplesLocations(): CouplesLocationData[] {
  return COUPLES_LOCATIONS;
}

/** Only locations marked published — used for the sitemap + indexability gating. */
export function getPublishedCouplesLocations(): CouplesLocationData[] {
  return COUPLES_LOCATIONS.filter((loc) => loc.published);
}

/** Look up a single location by slug regardless of publish state. Null if unknown. */
export function getCouplesLocation(slug: string): CouplesLocationData | null {
  return COUPLES_LOCATIONS.find((loc) => loc.slug === slug) ?? null;
}

/** Lightweight summaries for the locations hub grid and JSON-LD (all locations). */
export function getCouplesLocationSummaries(): CouplesLocationSummary[] {
  return getAllCouplesLocations().map((loc) => ({
    slug: loc.slug,
    name: loc.name,
    displayName: loc.displayName,
    area: loc.area,
    region: loc.region,
    cardSummary: loc.cardSummary,
    bestFor: loc.bestFor,
    lightingChar: loc.lightingChar,
    accessNote: loc.accessNote,
    heroAlt: loc.heroAlt,
    canonicalPath: loc.canonicalPath,
  }));
}
