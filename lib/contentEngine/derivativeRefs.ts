// Shared-derivative protection (spec §4.3): before deleting a derivative,
// count references across ALL supported live tables; delete only when no
// active placement remains. Also powers the orphaned-derivative report (§9.4).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DerivativePhoto {
  id: string;
  public_derivative_url: string | null;
}

export interface ReferenceCounts {
  blogCover: number;
  blogExtra: number;
  portfolio: number;
  schoolActive: number;
  familyGuide: number;
  couplesGuide: number;
  total: number;
}

export async function countLiveReferences(client: SupabaseClient, photo: DerivativePhoto): Promise<ReferenceCounts> {
  const url = photo.public_derivative_url;
  const zero: ReferenceCounts = {
    blogCover: 0, blogExtra: 0, portfolio: 0, schoolActive: 0, familyGuide: 0, couplesGuide: 0, total: 0,
  };
  if (!url) return zero;

  const [blogCover, blogExtra, portfolio, school, family, couples] = await Promise.all([
    client.from("blog_posts").select("id", { count: "exact", head: true }).eq("cover_image_url", url),
    client.from("blog_posts").select("id", { count: "exact", head: true }).contains("extra_image_urls", [url]),
    client.from("portfolio_images").select("id", { count: "exact", head: true }).eq("image_url", url),
    client.from("school_page_photos").select("id", { count: "exact", head: true })
      .eq("session_photo_id", photo.id).eq("active", true),
    client.from("family_location_photos").select("id", { count: "exact", head: true })
      .eq("image_url", url).eq("published", true),
    client.from("couples_location_photos").select("id", { count: "exact", head: true })
      .eq("image_url", url).eq("published", true),
  ]);

  const counts: ReferenceCounts = {
    blogCover: blogCover.count ?? 0,
    blogExtra: blogExtra.count ?? 0,
    portfolio: portfolio.count ?? 0,
    schoolActive: school.count ?? 0,
    familyGuide: family.count ?? 0,
    couplesGuide: couples.count ?? 0,
    total: 0,
  };
  counts.total = counts.blogCover + counts.blogExtra + counts.portfolio
    + counts.schoolActive + counts.familyGuide + counts.couplesGuide;
  return counts;
}
