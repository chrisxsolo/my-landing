import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const { linkId, userId } = (await request.json()) as {
      linkId?: number;
      userId?: string;
    };

    if (!linkId || !userId) {
      return new Response(null, { status: 204 });
    }

    const supabase = createSupabaseServerClient();
    await supabase.from("link_clicks").insert({ link_id: linkId, user_id: userId });
  } catch (error) {
    console.error("Failed to record link click", error);
  }

  return new Response(null, { status: 204 });
}
