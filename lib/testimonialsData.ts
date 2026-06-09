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
