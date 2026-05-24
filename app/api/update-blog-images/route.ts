import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildJournalImageLibraryRows } from "@/lib/imageLibraryShared";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { id, cover_image_url, extra_image_urls, all_image_urls } = await req.json() as {
    id: number;
    cover_image_url: string;
    extra_image_urls: string[];
    all_image_urls: string[];
  };

  if (!id || !cover_image_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data: post, error: fetchError } = await supabase
    .from("blog_posts")
    .select("slug, title")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("blog_posts")
    .update({ cover_image_url, extra_image_urls })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const rows = buildJournalImageLibraryRows({
      postId: id,
      postSlug: post.slug,
      postTitle: post.title,
      coverImageUrl: cover_image_url,
      extraImageUrls: all_image_urls.slice(1),
    });
    if (rows.length) {
      await supabase.from("image_library").delete().eq("source_post_id", id);
      await supabase.from("image_library").insert(rows);
    }
  } catch (err) {
    console.error("[update-blog-images] library sync error:", err);
  }

  return NextResponse.json({ ok: true });
}
