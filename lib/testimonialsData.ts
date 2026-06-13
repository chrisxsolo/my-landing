import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildTestimonialDisplayName, type TestimonialDisplayPreference } from "@/lib/testimonialValidation";

export type FeaturedTestimonial = {
  id: string;
  message: string;
  display_name: string;
  session_type: string | null;
};

// Homepage social proof. Returns only testimonials curated for the homepage:
// approved, published (published_at set), and featured — ordered by the admin's
// display_order. Selects just the public-safe fields; emails, consent metadata,
// gallery IDs, admin notes, and full last names never leave the server.
export async function getFeaturedTestimonials(limit = 6): Promise<FeaturedTestimonial[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("id,first_name,last_name,message,display_name_preference,session_type")
    .eq("status", "approved")
    .eq("featured", true)
    .not("published_at", "is", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 12));

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    display_name: buildTestimonialDisplayName(
      row.first_name,
      row.last_name,
      row.display_name_preference as TestimonialDisplayPreference,
    ),
    session_type: row.session_type,
  }));
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
