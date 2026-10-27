// The picker's non-engine sources: published Portfolio photos and the images
// of older journal posts, read from the same pool the public pages use, so a
// photo the site can place is a photo the admin can pick. Pure apart from the
// pool argument; the route loads the pool.
import { normalizePlaceName } from "@/lib/locations/match";
import type { PhotoPool } from "@/lib/pagePhotos/pool";
import type { PickerPhoto } from "@/lib/guidePhotoLibrary/load";
import { publicThumbUrl } from "@/lib/guidePhotoLibrary/load";

/** Outside the engine's tiers (0–2): shown only when browsing the whole library. */
export const EXTRA_SOURCE_TIER = 3;

export interface ExtraFilters {
  q?: string;
  /** Engine service type / portfolio category (grads, couples, families…). */
  category?: string;
  /** A /grads school slug. */
  school?: string;
}

const matches = (hay: string, q: string | undefined) => !q || normalizePlaceName(hay).includes(normalizePlaceName(q));

export function portfolioPickerPhotos(pool: PhotoPool, filters: ExtraFilters = {}): PickerPhoto[] {
  return pool.photos.filter((p) => p.eligible)
    .filter((p) => (!filters.category || p.category === filters.category) && (!filters.school || p.school === filters.school))
    .filter((p) => matches(`${p.title} ${p.alt} ${p.sessionLabel ?? ""}`, filters.q))
    .map((p) => ({
      id: `portfolio:${p.portfolioId}`, source: "portfolio", sessionId: p.engineSessionId ?? p.sessionKey,
      sessionName: p.sessionLabel ?? p.title, serviceType: p.category, schoolSlug: p.school,
      locationLabel: p.placeKey, thumbUrl: publicThumbUrl(p.url), webUrl: p.url, alt: p.alt,
      status: "approved", tier: EXTRA_SOURCE_TIER, excluded: false, qualityScore: p.quality, inGuide: null,
      originLabel: `Portfolio #${p.portfolioId}`, usedOnPages: null,
    }));
}

export function journalPickerPhotos(pool: PhotoPool, filters: ExtraFilters = {}): PickerPhoto[] {
  return pool.journal
    .filter((j) => (!filters.category || j.serviceType === filters.category) && (!filters.school || j.school === filters.school))
    .filter((j) => matches(`${j.postTitle} ${j.alt}`, filters.q))
    .map((j) => ({
      id: j.id, source: "journal", sessionId: j.sessionKey, sessionName: j.postTitle, serviceType: j.serviceType ?? "journal",
      schoolSlug: j.school, locationLabel: null, thumbUrl: publicThumbUrl(j.url), webUrl: j.url, alt: j.alt,
      status: "approved", tier: EXTRA_SOURCE_TIER, excluded: false, qualityScore: null, inGuide: null,
      originLabel: `Journal · ${j.postTitle}`, usedOnPages: null,
    }));
}

/** Both extra sources, minus any URL the engine list already shows. */
export function extraPickerPhotos(pool: PhotoPool, engineUrls: ReadonlySet<string>, filters: ExtraFilters = {}): PickerPhoto[] {
  return [...portfolioPickerPhotos(pool, filters), ...journalPickerPhotos(pool, filters)]
    .filter((p) => p.webUrl !== null && !engineUrls.has(p.webUrl));
}
