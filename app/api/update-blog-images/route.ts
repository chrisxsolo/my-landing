import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildJournalImageLibraryRows } from "@/lib/imageLibraryShared";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: {
    id: number;
    cover_image_url: string;
    extra_image_urls: string[];
    all_image_urls: string[];
  } | null;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id, cover_image_url, extra_image_urls, all_image_urls } = body ?? {};
  if (!id || !cover_image_url || !Array.isArray(extra_image_urls) || !Array.isArray(all_image_urls)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data: post, error: fetchError } = await supabase
    .from("blog_posts")
    .select("slug, title, cover_image_url, cover_image_alt, extra_image_urls, extra_image_alts")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // extra_image_alts is index-aligned with extra_image_urls (the blog page
  // reads extra_image_alts[i]) — reordering the urls without remapping the
  // alts would caption every photo with its neighbor's alt text.
  const altByUrl = new Map<string, string>();
  if (post.cover_image_url && post.cover_image_alt) {
    altByUrl.set(post.cover_image_url, post.cover_image_alt);
  }
  (post.extra_image_urls ?? []).forEach((url: string, i: number) => {
    const alt = post.extra_image_alts?.[i];
    if (url && alt) altByUrl.set(url, alt);
  });

  const { error } = await supabase
    .from("blog_posts")
    .update({
      cover_image_url,
      extra_image_urls,
      cover_image_alt: altByUrl.get(cover_image_url) ?? post.cover_image_alt ?? null,
      extra_image_alts: extra_image_urls.map((url) => altByUrl.get(url) ?? ""),
    })
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
      const { error: deleteError } = await supabase.from("image_library").delete().eq("source_post_id", id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("image_library").insert(rows);
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.error("[update-blog-images] library sync error:", err);
    return NextResponse.json(
      { error: "Post updated, but the image library failed to sync — retry to rebuild it." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
