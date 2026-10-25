// Which guide page covers a place. Static guide pages (hand-written configs in
// lib/*Guide/locations) are keyed by slug == place key; database guides
// (location_guides, created by approving a Content Engine proposal) carry an
// explicit location_key. A place is covered by a guide ONLY through that key —
// never because the scenery looks alike.
import { getAllCouplesLocations } from "@/lib/couplesGuide/locations";
import { getAllFamilyLocations } from "@/lib/familyGuide/locations";
import { getAllPortraitLocations } from "@/lib/portraitGuide/locations";
import { slugifyPlace } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";

export const LOCATION_GUIDE_TYPES = ["couples", "family", "portrait"] as const;
export type LocationGuideType = (typeof LOCATION_GUIDE_TYPES)[number];

export function isLocationGuideType(value: unknown): value is LocationGuideType {
  return typeof value === "string" && (LOCATION_GUIDE_TYPES as readonly string[]).includes(value);
}

const HUB: Record<LocationGuideType, string> = {
  couples: "/couples-guide",
  family: "/family-guide",
  portrait: "/portrait-guide",
};

export const GUIDE_LABEL: Record<LocationGuideType, string> = {
  couples: "Couples",
  family: "Family",
  portrait: "Portrait",
};

/** The guide-specific body section each template renders. */
export const GUIDE_SECTION_KEY = {
  couples: "movementInteraction",
  family: "familyConsiderations",
  portrait: "posingDirection",
} as const satisfies Record<LocationGuideType, string>;

export const GUIDE_SECTION_LABEL: Record<LocationGuideType, string> = {
  couples: "Movement & interaction",
  family: "Family considerations",
  portrait: "Posing direction",
};

export function guideHubPath(guide: LocationGuideType): string {
  return HUB[guide];
}

export function guideLocationPath(guide: LocationGuideType, slug: string): string {
  return `${HUB[guide]}/locations/${slug}`;
}

const LOCATION_PATH = /^\/(couples|family|portrait)-guide\/locations\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Parses "/couples-guide/locations/<slug>" → { guide, slug }, else null. */
export function parseGuideLocationPath(url: string): { guide: LocationGuideType; slug: string } | null {
  const m = LOCATION_PATH.exec(url);
  return m ? { guide: m[1] as LocationGuideType, slug: m[2] } : null;
}

export function staticGuideSlugs(guide: LocationGuideType): string[] {
  if (guide === "couples") return getAllCouplesLocations().map((l) => l.slug);
  if (guide === "family") return getAllFamilyLocations().map((l) => l.slug);
  return getAllPortraitLocations().map((l) => l.slug);
}

/** A published database guide, as the engine needs it. */
export interface DbGuideRef {
  guide: LocationGuideType;
  slug: string;
  locationKey: string;
  name: string;
}

export interface GuideMatch {
  guide: LocationGuideType;
  slug: string;
  url: string;
  source: "static" | "db";
}

/** The guide page of this type for this exact place, or null. */
export function findGuideForPlace(
  guide: LocationGuideType, placeKey: string, dbGuides: readonly DbGuideRef[],
): GuideMatch | null {
  if (staticGuideSlugs(guide).includes(placeKey)) {
    return { guide, slug: placeKey, url: guideLocationPath(guide, placeKey), source: "static" };
  }
  const db = dbGuides.find((g) => g.guide === guide && g.locationKey === placeKey);
  return db ? { guide, slug: db.slug, url: guideLocationPath(guide, db.slug), source: "db" } : null;
}

/**
 * Slug for a new guide page. San Francisco places keep the bare key (matching
 * the existing pages); places elsewhere carry their search city so the URL
 * states the real geography: shark-fin-cove → shark-fin-cove-santa-cruz.
 */
export function guideSlugForPlace(place: KnownPlace): string {
  if (place.searchArea === "San Francisco") return place.key;
  const area = slugifyPlace(place.searchArea);
  return place.key.endsWith(`-${area}`) ? place.key : `${place.key}-${area}`;
}

/** True when a slug or place is already taken by a hand-written guide page. */
export function collidesWithStaticGuide(guide: LocationGuideType, slug: string, placeKey: string): boolean {
  const slugs = staticGuideSlugs(guide);
  return slugs.includes(slug) || slugs.includes(placeKey);
}
