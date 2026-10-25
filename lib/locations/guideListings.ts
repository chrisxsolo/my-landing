// Server-only: hand-written guide pages + published database guides, for the
// guide hubs, location routes, and sitemap. (The static registries stay
// client-safe; this module adds the database half.)
import { getCouplesLocation, getCouplesLocationSummaries } from "@/lib/couplesGuide/locations";
import { getFamilyLocation, getFamilyLocationSummaries } from "@/lib/familyGuide/locations";
import { getPortraitLocation, getPortraitLocationSummaries } from "@/lib/portraitGuide/locations";
import {
  asCouplesLocation, asFamilyLocation, asPortraitLocation,
  getDbLocationGuide, getDbLocationGuides, type DbLocationGuide,
} from "@/lib/locations/dbGuides";
import type { CouplesLocationData, CouplesLocationSummary } from "@/lib/couplesGuide/types";
import type { FamilyLocationData } from "@/lib/familyGuide/types";
import type { PortraitLocationData } from "@/lib/portraitGuide/types";
import type { LocationGuideType } from "@/lib/locations/guideCoverage";

// Identical across the three guides (see each guide's *LocationSummary type).
type LocationSummary = CouplesLocationSummary;

function summaryOf(g: DbLocationGuide): LocationSummary {
  const d = g.data;
  return {
    slug: g.slug, name: d.name, area: d.area, region: d.region,
    cardSummary: d.cardSummary, bestFor: d.bestFor, lightingChar: d.lightingChar,
    accessNote: d.accessNote, heroAlt: d.heroAlt, canonicalPath: g.canonicalPath,
  };
}

async function withDb(guide: LocationGuideType, statics: LocationSummary[]): Promise<LocationSummary[]> {
  const db = await getDbLocationGuides(guide);
  const taken = new Set(statics.map((s) => s.slug));
  return [...statics, ...db.filter((g) => !taken.has(g.slug)).map(summaryOf)];
}

export const getCouplesLocationListing = () => withDb("couples", getCouplesLocationSummaries());
export const getFamilyLocationListing = () => withDb("family", getFamilyLocationSummaries());
export const getPortraitLocationListing = () => withDb("portrait", getPortraitLocationSummaries());

export async function findCouplesLocation(slug: string): Promise<CouplesLocationData | null> {
  const db = getCouplesLocation(slug) ? null : await getDbLocationGuide("couples", slug);
  return getCouplesLocation(slug) ?? (db ? asCouplesLocation(db) : null);
}

export async function findFamilyLocation(slug: string): Promise<FamilyLocationData | null> {
  const db = getFamilyLocation(slug) ? null : await getDbLocationGuide("family", slug);
  return getFamilyLocation(slug) ?? (db ? asFamilyLocation(db) : null);
}

export async function findPortraitLocation(slug: string): Promise<PortraitLocationData | null> {
  const db = getPortraitLocation(slug) ? null : await getDbLocationGuide("portrait", slug);
  return getPortraitLocation(slug) ?? (db ? asPortraitLocation(db) : null);
}

/** Canonical paths of indexable database guides, for the sitemap. */
export async function indexableDbGuidePaths(): Promise<string[]> {
  const all = await Promise.all((["couples", "family", "portrait"] as const).map((g) => getDbLocationGuides(g)));
  return all.flat().filter((g) => g.indexable).map((g) => g.canonicalPath);
}
