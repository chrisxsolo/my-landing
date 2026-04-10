import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const { userId } = (await request.json()) as { userId?: string };

    if (!userId) {
      return new Response(null, { status: 204 });
    }

    const supabase = createSupabaseServerClient();
    await supabase.from("link_views").insert({ user_id: userId });
  } catch (error) {
    console.error("Failed to record link page view", error);
  }

  return new Response(null, { status: 204 });
}
