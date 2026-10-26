// Splits one school page's photos into campus-spot sections for its location
// guide (/grads/<slug>/spots). Pure — the public guide and the admin preview
// both call it, so what admin sees is what visitors get.
//
//   • A spot section shows only photos the photographer tagged with that spot
//     (school_spot_photos). Text or AI hints never place a photo in a section.
//   • A tagged photo must still be eligible for the school page and not hidden
//     there; a tag never publishes anything.
//   • Featured first, then the tag's position, then the page's own order.
//   • With no tagged photo, a spot falls back to the photo already chosen for
//     it on the campus-spots guide (location_spots), unless hidden on the page.
//   • No photo appears twice: the hero is skipped, each photo lands in at most
//     one section, and the gallery only gets what the sections didn't use.
import type { PageCandidate } from "@/lib/pagePhotos/curate";
import type { SpotTag } from "@/lib/pagePhotos/pool";

export const SPOT_SECTION_LIMIT = 3;
export const SPOTS_GUIDE_GALLERY_LIMIT = 12;

export interface SpotFallback { url: string; alt: string }

export interface SpotPhotoInput {
  spotKeys: readonly string[];
  /** The page's photos in curated order (shown, then overflow). Hidden ones excluded. */
  eligible: readonly PageCandidate[];
  hiddenUrls: ReadonlySet<string>;
  heroUrl: string | null;
  tags: readonly SpotTag[];
  fallbacks: Readonly<Record<string, SpotFallback>>;
}

export interface SpotSectionPhoto {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  featured: boolean;
  /** "tag" = photographer-tagged; "campus-spot" = the campus-spots guide photo. */
  source: "tag" | "campus-spot";
}

export interface SpotPhotoLayout {
  bySpot: Record<string, SpotSectionPhoto[]>;
  /** Eligible photos not used by the hero or a section, in page order. */
  gallery: PageCandidate[];
}

function taggedFor(spotKey: string, input: SpotPhotoInput, order: Map<string, number>): SpotSectionPhoto[] {
  const byUrl = new Map(input.eligible.map((c) => [c.url, c]));
  return input.tags
    .filter((t) => t.spotKey === spotKey && byUrl.has(t.imageUrl) && t.imageUrl !== input.heroUrl)
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)
      || a.position - b.position
      || (order.get(a.imageUrl) ?? 0) - (order.get(b.imageUrl) ?? 0))
    .slice(0, SPOT_SECTION_LIMIT)
    .map((t) => {
      const c = byUrl.get(t.imageUrl) as PageCandidate;
      return { url: c.url, alt: c.alt, width: c.width, height: c.height, featured: t.isFeatured, source: "tag" as const };
    });
}

export function buildSpotPhotoLayout(input: SpotPhotoInput): SpotPhotoLayout {
  const order = new Map(input.eligible.map((c, i) => [c.url, i]));
  const bySpot: Record<string, SpotSectionPhoto[]> = {};
  const used = new Set<string>(input.heroUrl ? [input.heroUrl] : []);

  for (const key of input.spotKeys) {
    const tagged = taggedFor(key, input, order).filter((p) => !used.has(p.url));
    const fallback = input.fallbacks[key];
    const photos = tagged.length > 0 || !fallback || input.hiddenUrls.has(fallback.url) || used.has(fallback.url)
      ? tagged
      : [{ url: fallback.url, alt: fallback.alt, width: null, height: null, featured: true, source: "campus-spot" as const }];
    photos.forEach((p) => used.add(p.url));
    bySpot[key] = photos;
  }

  const gallery = input.eligible.filter((c) => !used.has(c.url)).slice(0, SPOTS_GUIDE_GALLERY_LIMIT);
  return { bySpot, gallery };
}

/** Normalized location_spots name, so "The SJSU Sign Wall\n" still matches. */
export function campusSpotNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
