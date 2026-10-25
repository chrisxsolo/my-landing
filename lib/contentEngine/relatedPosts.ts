// Existing journal posts a new post may link to, plus a publish check that
// every /blog/<slug> link in a body still points at a live post.
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectPostService } from "@/lib/blog/postService";
import { internalLinksInBody } from "@/lib/contentEngine/guideLinks";
import type { ServiceType } from "@/lib/contentEngine/taxonomy";

const BLOG_POSTS_TABLE = "blog_posts";
const RECENT_WINDOW = 40;
const MAX_RELATED = 3;
const BLOG_POST_PATH = /^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export interface RelatedPost {
  url: string;
  title: string;
}

/** Up to three recent published posts about the same service. */
export async function loadRelatedPosts(
  client: SupabaseClient, service: ServiceType,
): Promise<RelatedPost[]> {
  const { data, error } = await client.from(BLOG_POSTS_TABLE)
    .select("slug,title")
    .order("published_at", { ascending: false })
    .limit(RECENT_WINDOW);
  if (error) {
    // Related posts are optional: generate without them rather than fail.
    console.error("related posts lookup failed; generating without them", error);
    return [];
  }
  return (data ?? [])
    .filter((p) => detectPostService(`${p.title} ${p.slug}`) === service)
    .slice(0, MAX_RELATED)
    .map((p) => ({ url: `/blog/${p.slug}`, title: p.title as string }));
}

/** Slugs of /blog/<slug> links in a body. */
export function blogSlugsInBody(body: string): string[] {
  return [...new Set(internalLinksInBody(body)
    .map((path) => BLOG_POST_PATH.exec(path)?.[1])
    .filter((slug): slug is string => !!slug))];
}

/** /blog/<slug> links in the body whose post no longer exists. */
export async function missingBlogLinks(client: SupabaseClient, body: string): Promise<string[]> {
  const slugs = blogSlugsInBody(body);
  if (slugs.length === 0) return [];
  const { data, error } = await client.from(BLOG_POSTS_TABLE).select("slug").in("slug", slugs);
  if (error) throw new Error(`could not check linked blog posts: ${error.message}`);
  const live = new Set((data ?? []).map((r) => r.slug as string));
  return slugs.filter((s) => !live.has(s)).map((s) => `/blog/${s}`);
}
