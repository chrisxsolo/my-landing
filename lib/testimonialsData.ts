import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildTestimonialDisplayName, type TestimonialDisplayPreference } from "@/lib/testimonialValidation";

export type FeaturedTestimonial = {
  id: string;
  message: string;
  display_name: string;
  session_type: string | null;
  school: string | null;
  location: string | null;
  year: number | null;
  client_image_url: string | null;
  gallery_url: string | null;
  google_review_url: string | null;
  tags: string[];
};

// Public-safe columns. Emails, consent metadata, gallery IDs, admin notes, and
// full last names never leave the server.
const PUBLIC_SELECT =
  "id,first_name,last_name,message,display_name_preference,session_type," +
  "school,location,session_year,client_image_url,gallery_url,google_review_url,tags";

type PublicRow = {
  id: string;
  first_name: string;
  last_name: string;
  message: string;
  display_name_preference: string;
  session_type: string | null;
  school: string | null;
  location: string | null;
  session_year: number | null;
  client_image_url: string | null;
  gallery_url: string | null;
  google_review_url: string | null;
  tags: string[] | null;
};

function toFeatured(row: PublicRow): FeaturedTestimonial {
  return {
    id: row.id,
    message: row.message,
    display_name: buildTestimonialDisplayName(
      row.first_name,
      row.last_name,
      row.display_name_preference as TestimonialDisplayPreference,
    ),
    session_type: row.session_type,
    school: row.school,
    location: row.location,
    year: row.session_year,
    client_image_url: row.client_image_url,
    gallery_url: row.gallery_url,
    google_review_url: row.google_review_url,
    tags: row.tags ?? [],
  };
}

// Homepage social proof. Returns only testimonials curated for the homepage:
// approved, published (published_at set), and featured — ordered by the admin's
// display_order.
export async function getFeaturedTestimonials(limit = 6): Promise<FeaturedTestimonial[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select(PUBLIC_SELECT)
    .eq("status", "approved")
    .eq("featured", true)
    .not("published_at", "is", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 12));

  if (error) throw error;
  // Cast via unknown: the new metadata columns aren't in the generated Database
  // types yet, so the typed client widens the row to an error union.
  return ((data ?? []) as unknown as PublicRow[]).map(toFeatured);
}

// Maps a free-text testimonial session_type (e.g. "SJSU Graduation Session",
// "Maternity Session") onto a normalized portfolio category slug. Returns null
// when it doesn't clearly belong to a portfolio category.
export function testimonialCategorySlug(sessionType: string | null): string | null {
  if (!sessionType) return null;
  const value = sessionType.toLowerCase();
  if (value.includes("grad")) return "grads";
  if (value.includes("family") || value.includes("maternity") || value.includes("newborn")) {
    return "families";
  }
  if (value.includes("couple") || value.includes("engage")) return "couples";
  return null;
}

// Portfolio category proof. Reuses the homepage testimonial query, then keeps
// only the testimonials whose session_type maps to the requested category.
// Returns [] when none match, so the proof block renders nothing.
export async function getFeaturedTestimonialsForCategory(
  categorySlug: string,
  limit = 3,
): Promise<FeaturedTestimonial[]> {
  const all = await getFeaturedTestimonials(12);
  return all
    .filter((testimonial) => testimonialCategorySlug(testimonial.session_type) === categorySlug)
    .slice(0, Math.max(limit, 1));
}

// ── Contextual matching ───────────────────────────────────────────────────────
// Social proof converts best when it matches the visitor's concern. A school
// page wants a testimonial from that school; the couples pricing page wants a
// couples testimonial; posing tips want a reassured-nervous-client testimonial.

export type TestimonialMatch = {
  // Hard filter: only testimonials whose session_type maps to this category.
  category?: string | null;
  // Soft boosts: a testimonial that matches the school name or carries the tag
  // is preferred, but the block still falls back to a generic category match.
  school?: string | null;
  tag?: string | null;
};

const SCHOOL_BOOST = 10;
const TAG_BOOST = 5;

// Lowercase + strip everything but letters/digits so "UC Berkeley",
// "uc-berkeley", and "UC Berkeley Graduation Session" all compare equal-ish.
function normalizeForMatch(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// True when a testimonial plausibly belongs to the given school — checks both
// the structured `school` column and the free-text `session_type` (e.g. "SJSU
// Graduation Session"). Exported so a school page can label its proof block
// honestly: only claim "<School> grads" when a card on the page is actually
// from that campus, otherwise degrade to regional ("Bay Area grads") copy.
export function testimonialMatchesSchool(
  testimonial: FeaturedTestimonial,
  school: string | null,
): boolean {
  const needle = normalizeForMatch(school);
  if (needle.length < 3) return false;
  const haystacks = [normalizeForMatch(testimonial.school), normalizeForMatch(testimonial.session_type)];
  return haystacks.some((hay) => hay.length >= 3 && (hay.includes(needle) || needle.includes(hay)));
}

function scoreTestimonial(testimonial: FeaturedTestimonial, match: TestimonialMatch): number {
  if (match.category && testimonialCategorySlug(testimonial.session_type) !== match.category) {
    return 0;
  }
  let score = 1; // base for clearing the category filter (or no category given)
  if (match.school && testimonialMatchesSchool(testimonial, match.school)) score += SCHOOL_BOOST;
  if (match.tag && testimonial.tags.includes(match.tag.toLowerCase())) score += TAG_BOOST;
  return score;
}

// Returns the most contextually relevant featured testimonials for a page.
// Ranks the featured pool by relevance and keeps the strongest matches; returns
// [] when nothing clears the category filter, so the block renders nothing.
export async function getContextualTestimonials(
  match: TestimonialMatch,
  limit = 2,
): Promise<FeaturedTestimonial[]> {
  let pool: FeaturedTestimonial[];
  try {
    pool = await getFeaturedTestimonials(12);
  } catch (error) {
    // These placements only ever enhance a page; never break it on a DB hiccup.
    console.error("[getContextualTestimonials] failed to load testimonials", error);
    return [];
  }
  return pool
    .map((testimonial) => ({ testimonial, score: scoreTestimonial(testimonial, match) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit, 1))
    .map((entry) => entry.testimonial);
}
