// What public pages call. Server-only; reads the cached pool.
import { DEFAULT_PHOTO_RATIO } from "@/lib/couplesPortfolio";
import type { LocationGuideType } from "@/lib/locations/guideCoverage";
import { curatePage, type PageCandidate } from "@/lib/pagePhotos/curate";
import {
  candidatesForPage, curationFor, GUIDE_PAGE_LIMIT, SCHOOL_PAGE_LIMIT, type GuidePhotoRow,
} from "@/lib/pagePhotos/candidates";
import { guidePageKey, schoolPageKey } from "@/lib/pagePhotos/pageKeys";
import { getPhotoPool } from "@/lib/pagePhotos/pool";

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
