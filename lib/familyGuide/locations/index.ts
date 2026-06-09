// lib/familyGuide/locations/index.ts
// Registry of every family-photo location. To add a future location (Baker Beach,
// Legion of Honor, Golden Gate Park, Presidio Tunnel Tops, etc.):
//   1. Create a new ./<slug>.ts exporting a FamilyLocationData object.
//   2. Import it and add it to FAMILY_LOCATIONS below.
// The locations hub, the [slug] route (generateStaticParams), and the sitemap all
// read from here, so a new location appears everywhere automatically.

import type { FamilyLocationData, FamilyLocationSummary } from "@/lib/familyGuide/types";
import palaceOfFineArts from "./palace-of-fine-arts";
import crissyField from "./crissy-field";
import loversLane from "./lovers-lane";
import redwoodGrove from "./redwood-grove-nature-preserve";

// Order here is the display order on the locations hub.
export const FAMILY_LOCATIONS: FamilyLocationData[] = [
  palaceOfFineArts,
  crissyField,
  loversLane,
  redwoodGrove,
];

// Publishing model (per the "don't index thin pages" directive):
//   - Every location is LISTED on the hubs and REACHABLE by URL (the written copy
//     is genuinely useful), and is statically generated.
//   - `published` controls SEARCH visibility only: a location is added to the
//     sitemap and is indexable ONLY when published === true. Unpublished pages
//     render with a noindex robots tag and are kept out of the sitemap until they
//     have a credible set of photos. Flip `published: true` in the config to go live.

/** All locations — used for routing/static params and the hub listings. */
export function getAllFamilyLocations(): FamilyLocationData[] {
  return FAMILY_LOCATIONS;
}

/** Only locations marked published — used for the sitemap + indexability gating. */
export function getPublishedFamilyLocations(): FamilyLocationData[] {
  return FAMILY_LOCATIONS.filter((loc) => loc.published);
}

/** Look up a single location by slug regardless of publish state. Null if unknown. */
export function getFamilyLocation(slug: string): FamilyLocationData | null {
  return FAMILY_LOCATIONS.find((loc) => loc.slug === slug) ?? null;
}

/** Lightweight summaries for the locations hub grid and JSON-LD (all locations). */
export function getFamilyLocationSummaries(): FamilyLocationSummary[] {
  return getAllFamilyLocations().map((loc) => ({
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
