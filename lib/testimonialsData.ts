import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildTestimonialDisplayName, type TestimonialDisplayPreference } from "@/lib/testimonialValidation";

export type ApprovedTestimonial = {
  id: string;
  message: string;
  display_name: string;
  session_type: string | null;
  published_at: string | null;
};

export async function getApprovedTestimonials(limit = 12): Promise<ApprovedTestimonial[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("id,first_name,last_name,message,display_name_preference,session_type,published_at")
    .eq("status", "approved")
    .order("submitted_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

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
    published_at: row.published_at,
  }));
}
