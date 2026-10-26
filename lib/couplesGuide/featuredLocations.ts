// Server-only: the couples location guides that are live in search — hand-written
// guides marked `published` plus published, indexable database guides — each with
// a cover photo from couples_location_photos when one exists. Used by the couples
// portfolio, the couples guide, and the locations hub so only real, published
// guide pages are promoted (never a noindex page or a guide that doesn't exist).

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";
import { getPublishedCouplesLocations } from "@/lib/couplesGuide/locations";
import { getDbLocationGuides } from "@/lib/locations/dbGuides";
import { COUPLES_LOCATION_PHOTOS_TABLE } from "@/lib/couplesGuide/photos";
import { getMatchedGuideCovers } from "@/lib/pagePhotos/publicPages";

export type LocationCover = { image_url: string; alt: string };

export type FeaturedCouplesLocation = {
  slug: string;
  name: string;
  area: string;
  summary: string;
  bestFor: string;
  href: string;
  cover: LocationCover | null;
};

type CoverRow = { location_slug: string; image_url: string; alt_text: string | null };

/** First published photo (featured first, then sort order) for each slug. */
const getUploadedCovers = cachePublicContent(
  async (slugs: string[]): Promise<Record<string, LocationCover>> => {
    if (slugs.length === 0) return {};
    try {
      const { data, error } = await createSupabaseServerClient()
        .from(COUPLES_LOCATION_PHOTOS_TABLE)
        .select("location_slug,image_url,alt_text")
        .in("location_slug", slugs)
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("[couples locations] cover photos unavailable", error);
        return {};
      }
      return ((data ?? []) as CoverRow[]).reduce<Record<string, LocationCover>>((acc, row) => {
        if (acc[row.location_slug] || !row.image_url) return acc;
        return { ...acc, [row.location_slug]: { image_url: row.image_url, alt: row.alt_text ?? "" } };
      }, {});
    } catch (err) {
      console.error("[couples locations] cover photo read threw", err);
      return {};
    }
  },
  ["couples-location-covers"],
);

/**
 * Cover per guide: its own uploaded photo when it has one, else the first
 * public photo matched to that place (lib/pagePhotos).
 */
export async function getCouplesLocationCovers(slugs: string[]): Promise<Record<string, LocationCover>> {
  const uploaded = await getUploadedCovers(slugs);
  const missing = slugs.filter((slug) => !uploaded[slug]);
  return missing.length ? { ...(await getMatchedGuideCovers("couples", missing)), ...uploaded } : uploaded;
}

export async function getFeaturedCouplesLocations(): Promise<FeaturedCouplesLocation[]> {
  const statics = getPublishedCouplesLocations().map((loc) => ({
    slug: loc.slug,
    name: loc.displayName ?? loc.name,
    area: loc.area,
    summary: loc.cardSummary,
    bestFor: loc.bestFor,
    href: loc.canonicalPath,
  }));
  const taken = new Set(statics.map((loc) => loc.slug));
  const db = (await getDbLocationGuides("couples"))
    .filter((guide) => guide.indexable && !taken.has(guide.slug))
    .map((guide) => ({
      slug: guide.slug,
      name: guide.data.name,
      area: guide.data.area,
      summary: guide.data.cardSummary,
      bestFor: guide.data.bestFor,
      href: guide.canonicalPath,
    }));
  const all = [...db, ...statics];
  const covers = await getCouplesLocationCovers(all.map((loc) => loc.slug));
  const withCovers = all.map((loc) => ({
    ...loc,
    cover: covers[loc.slug] ? { ...covers[loc.slug], alt: covers[loc.slug].alt || `${loc.name} couples photography` } : null,
  }));
  // Guides with real photos lead.
  return [...withCovers.filter((loc) => loc.cover), ...withCovers.filter((loc) => !loc.cover)];
}
