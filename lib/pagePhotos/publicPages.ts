// What public pages call. Server-only; reads the cached pool.
import { DEFAULT_PHOTO_RATIO } from "@/lib/couplesPortfolio";
import type { LocationGuideType } from "@/lib/locations/guideCoverage";
import { curatePage, type PageCandidate } from "@/lib/pagePhotos/curate";
import {
  candidatesForPage, curationFor, GUIDE_PAGE_LIMIT, SCHOOL_PAGE_LIMIT, type GuidePhotoRow,
} from "@/lib/pagePhotos/candidates";
import { guidePageKey, schoolPageKey } from "@/lib/pagePhotos/pageKeys";
import { getPhotoPool, type PhotoPool } from "@/lib/pagePhotos/pool";
import { buildSpotPhotoLayout, campusSpotNameKey, type SpotFallback, type SpotSectionPhoto } from "@/lib/pagePhotos/spotPhotos";
import { SPOT_SCHOOL_IDS, type SchoolSlug } from "@/lib/contentEngine/taxonomy";
import { getLocationSpots, type LocationSpot } from "@/lib/gradGuideData";
import { spotKeysByPlace, spotsForSchool } from "@/lib/schoolSpots";

export interface PagePhoto {
  id: string;
  image_url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
}

export interface SchoolPagePhotos {
  hero: PagePhoto | null;
  gallery: PagePhoto[];
  /** Every eligible photo for this school, shown or not. */
  matchedCount: number;
}

function toPagePhoto(c: PageCandidate): PagePhoto {
  const sized = Boolean(c.width && c.height);
  return {
    id: c.id,
    image_url: c.url,
    alt: c.alt,
    caption: c.caption,
    width: sized ? Number(c.width) : DEFAULT_PHOTO_RATIO.width,
    height: sized ? Number(c.height) : DEFAULT_PHOTO_RATIO.height,
  };
}

const EMPTY: SchoolPagePhotos = { hero: null, gallery: [], matchedCount: 0 };

export async function getSchoolPagePhotos(slug: string): Promise<SchoolPagePhotos> {
  const pool = await getPhotoPool();
  if (!pool) return EMPTY;
  const key = schoolPageKey(slug);
  const candidates = candidatesForPage(pool, key);
  const { ordered, overflow } = curatePage(candidates, curationFor(pool, key), {
    limit: SCHOOL_PAGE_LIMIT, preferPortraitHero: true, mixPlacements: true,
  });
  const [hero, ...gallery] = ordered.map(toPagePhoto);
  return { hero: hero ?? null, gallery, matchedCount: ordered.length + overflow.length };
}

export interface SchoolSpotsGuidePhotos {
  hero: PagePhoto | null;
  bySpot: Record<string, PagePhoto[]>;
  gallery: PagePhoto[];
}

function sectionPhoto(spotKey: string, index: number, p: SpotSectionPhoto): PagePhoto {
  const sized = Boolean(p.width && p.height);
  return {
    id: `spot:${spotKey}:${index}`, image_url: p.url, alt: p.alt, caption: null,
    width: sized ? Number(p.width) : DEFAULT_PHOTO_RATIO.width,
    height: sized ? Number(p.height) : DEFAULT_PHOTO_RATIO.height,
  };
}

/** Each spot's photo on the campus-spots guide, matched by the spot's known names. */
function campusSpotFallbacks(
  slug: string, schoolShort: string, spotRows: readonly LocationSpot[],
): Record<string, SpotFallback> {
  const schoolId = SPOT_SCHOOL_IDS[slug as SchoolSlug];
  if (!schoolId) return {};
  const rows = spotRows.filter((row) => row.school_id === schoolId && row.image_url);
  return Object.fromEntries(spotsForSchool(slug).flatMap((spot) => {
    const names = new Set(spot.campusSpotNames.map(campusSpotNameKey));
    const row = rows.find((r) => names.has(campusSpotNameKey(r.name)));
    return row?.image_url
      ? [[spot.key, { url: row.image_url, alt: `${schoolShort} graduation portrait ${spot.altPlace ?? `at the ${spot.name}`}` }]]
      : [];
  }));
}

/**
 * The school location guide's photos: the school page's hero, photographer-
 * tagged photos per spot (or, for an off-campus spot, this school's photos
 * shot at that place), and the remaining eligible photos as the gallery.
 * Uses the school page's own curation (pins, hides, hero), so only photos
 * already matched to this school can appear — a couples session at the
 * Palace never reaches a school guide.
 */
export function buildSchoolSpotsGuidePhotos(
  pool: PhotoPool | null, spotRows: readonly LocationSpot[], slug: string, schoolShort: string,
): SchoolSpotsGuidePhotos {
  const fallbacks = campusSpotFallbacks(slug, schoolShort, spotRows);
  const spotKeys = spotsForSchool(slug).map((spot) => spot.key);
  const key = schoolPageKey(slug);
  const curated = pool
    ? curatePage(candidatesForPage(pool, key), curationFor(pool, key), {
        limit: Number.MAX_SAFE_INTEGER, preferPortraitHero: true, mixPlacements: true,
      })
    : { ordered: [] };
  const [heroCandidate] = curated.ordered;
  const layout = buildSpotPhotoLayout({
    spotKeys,
    eligible: curated.ordered,
    // From the curation rows, so a hide also covers a campus-spot fallback.
    hiddenUrls: new Set(pool ? curationFor(pool, key).filter((r) => r.mode === "hide").map((r) => r.imageUrl) : []),
    heroUrl: heroCandidate?.url ?? null,
    tags: pool ? pool.spotTags.filter((t) => t.schoolSlug === slug) : [],
    fallbacks,
    placeSpots: spotKeysByPlace(slug),
  });
  return {
    hero: heroCandidate ? toPagePhoto(heroCandidate) : null,
    bySpot: Object.fromEntries(Object.entries(layout.bySpot)
      .map(([spot, photos]) => [spot, photos.map((p, i) => sectionPhoto(spot, i, p))])),
    gallery: layout.gallery.map(toPagePhoto),
  };
}

/** Cached public read of buildSchoolSpotsGuidePhotos. */
export async function getSchoolSpotsGuidePhotos(slug: string, schoolShort: string): Promise<SchoolSpotsGuidePhotos> {
  const [pool, spotRows] = await Promise.all([getPhotoPool(), getLocationSpots()]);
  return buildSchoolSpotsGuidePhotos(pool, spotRows, slug, schoolShort);
}

/**
 * A guide's own uploads plus the public photos matched to its place, in
 * curated order. If the pool can't be read the page keeps its own uploads.
 */
export async function withMatchedGuidePhotos<T extends GuidePhotoRow>(
  guide: LocationGuideType, slug: string, own: T[],
): Promise<GuidePhotoRow[]> {
  const pool = await getPhotoPool();
  if (!pool) return own;
  const key = guidePageKey(guide, slug);
  const ownByUrl = new Map<string, GuidePhotoRow>(own.map((row) => [row.image_url, row]));
  const { ordered } = curatePage(candidatesForPage(pool, key, own), curationFor(pool, key), {
    limit: Math.max(GUIDE_PAGE_LIMIT, own.length),
  });
  return ordered.map((c) => ownByUrl.get(c.url) ?? {
    id: c.id, image_url: c.url, alt_text: c.alt || null, caption: c.caption, featured: false,
  });
}

/** Resolved school per portfolio photo URL, for the /portfolio school filter. */
export async function getPortfolioSchoolsByUrl(): Promise<Record<string, string>> {
  const pool = await getPhotoPool();
  if (!pool) return {};
  return Object.fromEntries(pool.photos.flatMap((p) => (p.school ? [[p.url, p.school]] : [])));
}

/** First curated matched photo per guide slug, for hub cards with no uploaded cover. */
export async function getMatchedGuideCovers(
  guide: LocationGuideType, slugs: string[],
): Promise<Record<string, { image_url: string; alt: string }>> {
  const pool = await getPhotoPool();
  if (!pool) return {};
  return Object.fromEntries(slugs.flatMap((slug) => {
    const key = guidePageKey(guide, slug);
    const [first] = curatePage(candidatesForPage(pool, key), curationFor(pool, key), { limit: 1 }).ordered;
    return first ? [[slug, { image_url: first.url, alt: first.alt }]] : [];
  }));
}
