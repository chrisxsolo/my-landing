// Builds one page's candidate list from the pool: its explicit placements plus
// every eligible photo automatically matched to it. Pure — shared by the public
// pages and the admin preview.
import type { PageCandidate } from "@/lib/pagePhotos/curate";
import { parsePageKey } from "@/lib/pagePhotos/pageKeys";
import type { PhotoPool } from "@/lib/pagePhotos/pool";

/** Grad pages: one hero + a 12-photo gallery. */
export const SCHOOL_PAGE_LIMIT = 13;
/** Location guides: at least this many, never fewer than their own uploads. */
export const GUIDE_PAGE_LIMIT = 18;

/** The row shape every *_location_photos reader already returns. */
export interface GuidePhotoRow {
  id: string | number;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  featured: boolean;
}

export function candidatesForPage(
  pool: PhotoPool, pageKey: string, guideRows: readonly GuidePhotoRow[] = [],
): PageCandidate[] {
  const parsed = parsePageKey(pageKey);
  if (!parsed) return [];
  const byUrl = new Map(pool.photos.map((p) => [p.url, p]));

  const school: PageCandidate[] = parsed.kind === "grads"
    ? pool.explicitSchool.filter((s) => s.schoolSlug === parsed.slug).map((s) => ({
        id: `school:${s.id}`, url: s.url, alt: s.alt, caption: s.caption,
        width: s.width, height: s.height, explicit: true, explicitOrder: s.sortOrder,
        featured: byUrl.get(s.url)?.featured ?? false, quality: s.quality,
        sortOrder: s.sortOrder, sessionKey: s.sessionKey,
      }))
    : [];

  const guide: PageCandidate[] = guideRows.map((row, index) => {
    const known = byUrl.get(row.image_url);
    return {
      id: `guide:${row.id}`, url: row.image_url, alt: row.alt_text ?? known?.alt ?? "", caption: row.caption,
      width: known?.width ?? null, height: known?.height ?? null, explicit: true, explicitOrder: index,
      featured: row.featured, quality: known?.quality ?? null, sortOrder: index,
      sessionKey: known?.sessionKey ?? `guide:${row.id}`,
    };
  });

  const matched: PageCandidate[] = pool.photos.filter((p) => p.pages.includes(pageKey)).map((p) => ({
    id: `portfolio:${p.portfolioId}`, url: p.url, alt: p.alt, caption: null,
    width: p.width, height: p.height, explicit: false, explicitOrder: 0,
    featured: p.featured, quality: p.quality, sortOrder: p.sortOrder, sessionKey: p.sessionKey,
  }));

  return [...school, ...guide, ...matched];
}

export function curationFor(pool: PhotoPool, pageKey: string) {
  return pool.curation.filter((row) => row.pageKey === pageKey);
}
