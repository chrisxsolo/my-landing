// Connects the campus-spots page (/grad-guide/campus-spots) to the fill plan.
// Pure — the public page, the sync and the tests share it.
//
//   • campusSpotSlots: the page's spots as slots (school slug + spot key).
//     A spot with no lib/schoolSpots definition can't be matched and is skipped.
//   • fillCandidates: one school page's eligible photos, with the facts the
//     matcher needs. Same curated list as /grads/<slug>, so hidden photos and
//     photos of other schools never qualify.
//   • applyAutoPhotos: shows an automatic photo only on a spot with no photo,
//     only while that photo is still eligible, and never twice on the page.
import type { LocationSpot } from "@/lib/gradGuideData";
import type { AutoRow, FillCandidate, SpotSlot } from "@/lib/campusSpotFill/match";
import { curatePage } from "@/lib/pagePhotos/curate";
import { candidatesForPage, curationFor } from "@/lib/pagePhotos/candidates";
import { schoolPageKey } from "@/lib/pagePhotos/pageKeys";
import type { PhotoPool } from "@/lib/pagePhotos/pool";
import { campusSpotNameKey } from "@/lib/pagePhotos/spotPhotos";
import { SPOT_SCHOOL_IDS, type SchoolSlug } from "@/lib/contentEngine/taxonomy";
import { spotsForSchool } from "@/lib/schoolSpots";

const SLUG_BY_SPOT_SCHOOL_ID = new Map(
  Object.entries(SPOT_SCHOOL_IDS).map(([slug, id]) => [id as string, slug as SchoolSlug]),
);

/** Schools on the campus-spots page, as /grads slugs. */
export const CAMPUS_SPOT_SCHOOLS: readonly SchoolSlug[] = [...SLUG_BY_SPOT_SCHOOL_ID.values()];

export function schoolSlugForSpot(spot: Pick<LocationSpot, "school_id">): SchoolSlug | null {
  return SLUG_BY_SPOT_SCHOOL_ID.get(spot.school_id) ?? null;
}

/** The spot's lib/schoolSpots key: set on guide spots, else found by the row's name. */
export function spotKeyOf(spot: Pick<LocationSpot, "school_id" | "name" | "spot_key">): string | null {
  if (spot.spot_key) return spot.spot_key;
  const slug = schoolSlugForSpot(spot);
  if (!slug) return null;
  const name = campusSpotNameKey(spot.name);
  const def = spotsForSchool(slug).find((d) => d.campusSpotNames.some((n) => campusSpotNameKey(n) === name));
  return def?.key ?? null;
}

export function campusSpotSlots(spots: readonly LocationSpot[]): SpotSlot[] {
  const bySlot = new Map<string, SpotSlot>();
  for (const spot of spots) {
    const schoolSlug = schoolSlugForSpot(spot);
    const spotKey = spotKeyOf(spot);
    if (!schoolSlug || !spotKey) continue;
    const id = `${schoolSlug}:${spotKey}`;
    const prev = bySlot.get(id);
    bySlot.set(id, {
      schoolSlug, spotKey, name: prev?.name ?? spot.name.trim(),
      shownUrl: prev?.shownUrl ?? spot.image_url ?? null,
    });
  }
  return [...bySlot.values()];
}

const sessionIdOf = (sessionKey: string) => (sessionKey.startsWith("session:") ? sessionKey.slice(8) : null);

/** One school page's eligible photos, in its curated order. */
export function fillCandidates(pool: PhotoPool, slug: SchoolSlug): FillCandidate[] {
  const key = schoolPageKey(slug);
  const { ordered, overflow } = curatePage(candidatesForPage(pool, key), curationFor(pool, key), {
    limit: Number.MAX_SAFE_INTEGER, preferPortraitHero: true, mixPlacements: true,
  });
  const titleByUrl = new Map(pool.photos.map((p) => [p.url, p.title]));
  const tagByUrl = new Map(pool.spotTags.filter((t) => t.schoolSlug === slug).map((t) => [t.imageUrl, t]));
  return [...ordered, ...overflow].map((c, order) => {
    const sessionId = sessionIdOf(c.sessionKey);
    const tag = tagByUrl.get(c.url);
    return {
      url: c.url,
      schoolSlug: slug,
      text: [titleByUrl.get(c.url), c.alt].filter(Boolean).join(" · "),
      width: c.width, height: c.height, quality: c.quality, featured: c.featured, order,
      placeKey: c.placeKey ?? null,
      tag: tag ? { spotKey: tag.spotKey, featured: tag.isFeatured } : null,
      sessionLocations: sessionId ? pool.sessionLocations?.[sessionId] ?? [] : [],
    };
  });
}

/** Eligible photo URLs per school, for the render-time check. */
export function eligibleUrlsBySchool(pool: PhotoPool): Map<string, Set<string>> {
  return new Map(CAMPUS_SPOT_SCHOOLS.map((slug) => [slug, new Set(fillCandidates(pool, slug).map((c) => c.url))]));
}

/**
 * Spots with no photo get their automatic photo, if it is still eligible for
 * the spot's school and not already shown elsewhere on the page. Spots that
 * show a photo are returned unchanged.
 */
export function applyAutoPhotos(
  spots: readonly LocationSpot[], rows: readonly AutoRow[], eligible: ReadonlyMap<string, ReadonlySet<string>>,
): LocationSpot[] {
  const shown = new Set(spots.flatMap((s) => (s.image_url ? [s.image_url] : [])));
  const rowBySlot = new Map(rows.map((r) => [`${r.schoolSlug}:${r.spotKey}`, r]));
  return spots.map((spot) => {
    if (spot.image_url) return spot;
    const slug = schoolSlugForSpot(spot);
    const key = spotKeyOf(spot);
    const row = slug && key ? rowBySlot.get(`${slug}:${key}`) : undefined;
    if (!row || !eligible.get(row.schoolSlug)?.has(row.imageUrl) || shown.has(row.imageUrl)) return spot;
    shown.add(row.imageUrl);
    return { ...spot, image_url: row.imageUrl };
  });
}
