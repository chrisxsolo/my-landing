// lib/familyGuide/photos.ts
// Server-only helpers for reading family-guide photographs from Supabase.
// The family_location_photos table is locked down (service-role only), so these
// run on the server via createSupabaseServerClient() and the results are passed
// into the (server-rendered) templates — images land in the initial HTML, and no
// anon read policy is needed. Galleries stay empty (neutral placeholder) until
// Chris uploads work, so nothing here ever blocks a page from rendering.

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const FAMILY_LOCATION_PHOTOS_TABLE = "family_location_photos";

export type FamilyPhoto = {
  id: string | number;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  featured: boolean;
};

type RawFamilyPhoto = Partial<FamilyPhoto> & { sort_order?: number | null };

function normalize(raw: RawFamilyPhoto): FamilyPhoto | null {
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
export async function getFamilyLocationPhotos(slug: string): Promise<FamilyPhoto[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(FAMILY_LOCATION_PHOTOS_TABLE)
      .select("id,image_url,alt_text,caption,featured,sort_order")
      .eq("location_slug", slug)
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error || !data) {
      if (error) console.error(`Failed to load family photos for ${slug}`, error);
      return [];
    }
    return data.map(normalize).filter((p): p is FamilyPhoto => p !== null);
  } catch (err) {
    console.error(`family_location_photos load threw for ${slug}`, err);
    return [];
  }
}

/** The featured (or first) photo for a location, used as the hero image. Null when none. */
export async function getFamilyLocationHero(slug: string): Promise<FamilyPhoto | null> {
  const photos = await getFamilyLocationPhotos(slug);
  return photos[0] ?? null;
}
