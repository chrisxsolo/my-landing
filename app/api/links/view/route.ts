import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const { userId, referrer, device } = (await request.json()) as {
      userId?: string;
      referrer?: string;
      device?: string;
    };

    if (!userId) {
      return new Response(null, { status: 204 });
    }

    const supabase = createSupabaseServerClient();
    await supabase.from("link_views").insert({
      user_id: userId,
      referrer: referrer ?? null,
      device: device ?? null,
    });
  } catch (error) {
    console.error("Failed to record link page view", error);
  }

  return new Response(null, { status: 204 });
}
