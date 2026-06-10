// lib/couplesGuide/photos.ts
// Server-only helpers for reading couples-guide photographs from Supabase.
// The couples_location_photos table is locked down (service-role writes only),
// with a public read policy limited to published rows, so these run on the server
// via createSupabaseServerClient() and the results are passed into the
// (server-rendered) templates — images land in the initial HTML. Galleries stay
// empty (neutral placeholder) until Chris uploads work, so nothing here ever
// blocks a page from rendering. Mirrors lib/familyGuide/photos.ts.

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const COUPLES_LOCATION_PHOTOS_TABLE = "couples_location_photos";

export type CouplesPhoto = {
  id: string | number;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  featured: boolean;
};

type RawCouplesPhoto = Partial<CouplesPhoto> & { sort_order?: number | null };

function normalize(raw: RawCouplesPhoto): CouplesPhoto | null {
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
export async function getCouplesLocationPhotos(slug: string): Promise<CouplesPhoto[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(COUPLES_LOCATION_PHOTOS_TABLE)
      .select("id,image_url,alt_text,caption,featured,sort_order")
      .eq("location_slug", slug)
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error || !data) {
      if (error) console.error(`Failed to load couples photos for ${slug}`, error);
      return [];
    }
    return data.map(normalize).filter((p): p is CouplesPhoto => p !== null);
  } catch (err) {
    console.error(`couples_location_photos load threw for ${slug}`, err);
    return [];
  }
}

/** The featured (or first) photo for a location, used as the hero image. Null when none. */
export async function getCouplesLocationHero(slug: string): Promise<CouplesPhoto | null> {
  const photos = await getCouplesLocationPhotos(slug);
  return photos[0] ?? null;
}
