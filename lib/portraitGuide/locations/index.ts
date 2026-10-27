// lib/portraitGuide/locations/index.ts
// Registry of every portrait-guide location. To add a future location (Lands End,
// Sutro Baths, Salesforce Park, Bernal Heights, Twin Peaks, Marin Headlands,
// Presidio Tunnel Tops, etc.):
//   1. Create a new ./<slug>.ts exporting a PortraitLocationData object.
//   2. Import it and add it to PORTRAIT_LOCATIONS below.
// The locations hub, the [slug] route (generateStaticParams), the sitemap, and the
// admin photo dropdown all read from here, so a new location appears everywhere
// automatically. Mirrors lib/couplesGuide/locations/index.ts.

import type { PortraitLocationData, PortraitLocationSummary } from "@/lib/portraitGuide/types";
import goldenGatePark from "./golden-gate-park";
import palaceOfFineArts from "./palace-of-fine-arts";
import embarcadero from "./embarcadero";
import bakerBeach from "./baker-beach";
import missionMurals from "./mission-murals";

// Order here is the display order on the locations hub.
export const PORTRAIT_LOCATIONS: PortraitLocationData[] = [
  goldenGatePark,
  palaceOfFineArts,
  embarcadero,
  bakerBeach,
  missionMurals,
];

// Publishing model (per the "don't index thin pages" directive):
//   - Every location is REACHABLE by URL and statically generated (the written copy
//     is genuinely useful). Public hubs and related links list ONLY published
//     locations, so no public page points search engines at a noindex guide;
//     admin screens still see every location.
//   - `published` controls search and listing visibility: a location is added to the
//     sitemap and is indexable ONLY when published === true. Unpublished pages
//     render with a noindex robots tag and are kept out of the sitemap until they
//     have a credible set of photos. Flip `published: true` in the config to go live.

/** All locations — routing/static params, admin screens, and the content engine. */
export function getAllPortraitLocations(): PortraitLocationData[] {
  return PORTRAIT_LOCATIONS;
}

/** Only locations marked published — used for the sitemap + indexability gating. */
export function getPublishedPortraitLocations(): PortraitLocationData[] {
  return PORTRAIT_LOCATIONS.filter((loc) => loc.published);
}

/** Look up a single location by slug regardless of publish state. Null if unknown. */
export function getPortraitLocation(slug: string): PortraitLocationData | null {
  return PORTRAIT_LOCATIONS.find((loc) => loc.slug === slug) ?? null;
}

/** Lightweight summaries for the public hub grids and JSON-LD (published locations only). */
export function getPortraitLocationSummaries(): PortraitLocationSummary[] {
  return getPublishedPortraitLocations().map((loc) => ({
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
