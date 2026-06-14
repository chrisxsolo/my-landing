import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { normalizePortfolioCategorySlug } from "@/lib/photoMetadata";

// A per-session story block shown on /portfolio: location, time of day, what the
// client wanted, a gallery preview, and a testimonial. Curated in the admin
// Case Studies tab; the public page renders nothing when none are active.
export type PortfolioCaseStudy = {
  id: number;
  category_slug: string;
  school: string | null;
  title: string;
  client_name: string | null;
  location: string | null;
  time_of_day: string | null;
  client_goal: string | null;
  summary: string | null;
  testimonial_quote: string | null;
  testimonial_author: string | null;
  cover_image_url: string | null;
  preview_image_urls: string[];
  sort_order: number;
};

const CASE_STUDY_COLUMNS =
  "id,category_slug,school,title,client_name,location,time_of_day,client_goal,summary,testimonial_quote,testimonial_author,cover_image_url,preview_image_urls,sort_order";

type RawCaseStudy = Partial<PortfolioCaseStudy> & { preview_image_urls?: string[] | null };

function normalize(raw: RawCaseStudy): PortfolioCaseStudy {
  return {
    id: Number(raw.id ?? 0),
    category_slug: normalizePortfolioCategorySlug(raw.category_slug),
    school: raw.school ?? null,
    title: raw.title ?? "",
    client_name: raw.client_name ?? null,
    location: raw.location ?? null,
    time_of_day: raw.time_of_day ?? null,
    client_goal: raw.client_goal ?? null,
    summary: raw.summary ?? null,
    testimonial_quote: raw.testimonial_quote ?? null,
    testimonial_author: raw.testimonial_author ?? null,
    cover_image_url: raw.cover_image_url ?? null,
    preview_image_urls: Array.isArray(raw.preview_image_urls) ? raw.preview_image_urls.filter(Boolean) : [],
    sort_order: Number(raw.sort_order ?? 0),
  };
}

// Active case studies for a category (or all when no slug). Returns [] on error
// so the portfolio page always renders. category_slug is normalized both ways so
// a stored "graduation" matches a requested "grads".
export async function getPortfolioCaseStudies(categorySlug?: string | null): Promise<PortfolioCaseStudy[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("portfolio_case_studies")
      .select(CASE_STUDY_COLUMNS)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error || !data) return [];

    const studies = data.map((row) => normalize(row as RawCaseStudy)).filter((study) => study.title);
    if (!categorySlug) return studies;

    const wanted = normalizePortfolioCategorySlug(categorySlug);
    return studies.filter((study) => study.category_slug === wanted);
  } catch (error) {
    console.error("Failed to load portfolio case studies", error);
    return [];
  }
}
