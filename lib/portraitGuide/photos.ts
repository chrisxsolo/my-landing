// lib/portraitGuide/photos.ts
// Server-only helpers for reading portrait-guide photographs from Supabase.
// The portrait_location_photos table is locked down (service-role writes only),
// with a public read policy limited to published rows, so these run on the server
// via createSupabaseServerClient() and the results are passed into the
// (server-rendered) templates — images land in the initial HTML. Galleries stay
// empty (neutral placeholder) until Chris uploads work, so nothing here ever
// blocks a page from rendering. Mirrors lib/couplesGuide/photos.ts.

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const PORTRAIT_LOCATION_PHOTOS_TABLE = "portrait_location_photos";

export type PortraitPhoto = {
  id: string | number;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  featured: boolean;
};

type RawPortraitPhoto = Partial<PortraitPhoto> & { sort_order?: number | null };

function normalize(raw: RawPortraitPhoto): PortraitPhoto | null {
  if (!raw.image_url) return null;
  return {
    id: raw.id ?? raw.image_url,
    image_url: raw.image_url,
    alt_text: raw.alt_text ?? null,
    caption: raw.caption ?? null,
    featured: raw.featured ?? false,
  };
}

/**
 * Published photos for a single location slug, featured first then by sort order.
 * Returns [] on any error or missing table so the page still renders.
 */
export async function getPortraitLocationPhotos(slug: string): Promise<PortraitPhoto[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(PORTRAIT_LOCATION_PHOTOS_TABLE)
      .select("id,image_url,alt_text,caption,featured,sort_order")
      .eq("location_slug", slug)
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error || !data) {
      if (error) console.error(`Failed to load portrait photos for ${slug}`, error);
      return [];
    }
    return data.map(normalize).filter((p): p is PortraitPhoto => p !== null);
  } catch (err) {
    console.error(`portrait_location_photos load threw for ${slug}`, err);
    return [];
  }
}

/** The featured (or first) photo for a location, used as the hero image. Null when none. */
export async function getPortraitLocationHero(slug: string): Promise<PortraitPhoto | null> {
  const photos = await getPortraitLocationPhotos(slug);
  return photos[0] ?? null;
}
