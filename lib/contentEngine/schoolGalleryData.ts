// Public school-gallery query (spec §3.5, §5): joins school_page_photos →
// session_photos for the derivative URL and canonical alt. Server-only —
// called from server components through the service-role client; the browser
// never touches engine tables. Photos without a published derivative are
// excluded defensively (publication always creates one, spec §9.1 Step A).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SchoolGalleryPhoto {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
}

interface SessionPhotoEmbed {
  public_derivative_url: string | null;
  alt_text: string | null;
}

interface PlacementRow {
  id: string;
  alt_override: string | null;
  caption: string | null;
  // PostgREST may return many-to-one as object OR array depending on stack version
  session_photos: SessionPhotoEmbed | SessionPhotoEmbed[] | null;
}

function extractPhoto(embed: SessionPhotoEmbed | SessionPhotoEmbed[] | null): SessionPhotoEmbed | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed;
}

export async function getSchoolGalleryPhotos(
  client: SupabaseClient, schoolSlug: string,
): Promise<SchoolGalleryPhoto[]> {
  const { data, error } = await client
    .from("school_page_photos")
    .select("id,alt_override,caption,session_photos!inner(public_derivative_url,alt_text)")
    .eq("school_slug", schoolSlug)
    .eq("active", true)
    .order("sort_order")
    .order("created_at");
  if (error) {
    console.error(`school gallery query failed for ${schoolSlug}:`, error.message);
    return []; // a gallery failure must never break the page
  }
  return ((data ?? []) as unknown as PlacementRow[])
    .map((row) => ({ row, photo: extractPhoto(row.session_photos) }))
    .filter(({ photo }) => photo?.public_derivative_url)
    .map(({ row, photo }) => ({
      id: row.id,
      url: photo!.public_derivative_url as string,
      alt: row.alt_override?.trim()
        ? row.alt_override
        : photo!.alt_text ?? "Graduation portrait by soloxsnaps",
      caption: row.caption,
    }));
}
