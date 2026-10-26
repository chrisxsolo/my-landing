// Related content for library locations — only pages that exist and are live:
// the location guide pages that cover the same place key (static or
// published database guides), and published journal posts from the sessions
// linked to the location. Two queries for the whole library.
import type { SupabaseClient } from "@supabase/supabase-js";
import { findGuideForPlace, GUIDE_LABEL, LOCATION_GUIDE_TYPES } from "@/lib/locations/guideCoverage";
import { loadPublishedDbGuides } from "@/lib/locations/registry";
import type { LibraryLocation } from "@/lib/locationLibrary/load";

const MAX_JOURNAL_LINKS = 3;

export interface RelatedLink {
  kind: "guide" | "journal";
  label: string;
  href: string;
}

interface JournalPost {
  sessionId: string;
  title: string;
  slug: string;
  publishedAt: string;
}

async function loadJournalPosts(client: SupabaseClient, sessionIds: string[]): Promise<JournalPost[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await client.from("session_content_items")
    .select("published_target_id,published_ref,session_content_packages!inner(photography_session_id)")
    .eq("content_type", "journal_post").eq("status", "published").eq("published_target_type", "blog_post")
    .in("session_content_packages.photography_session_id", sessionIds);
  if (error) throw new Error(`could not load journal items: ${error.message}`);
  const live = (data ?? []).filter((i) => !(i.published_ref as { taken_down_at?: string } | null)?.taken_down_at);
  const sessionByPost = new Map<string, string>();
  for (const item of live) {
    const pkg = item.session_content_packages as unknown as { photography_session_id: string } | { photography_session_id: string }[];
    const one = Array.isArray(pkg) ? pkg[0] : pkg;
    if (item.published_target_id && one) sessionByPost.set(String(item.published_target_id), one.photography_session_id);
  }
  if (sessionByPost.size === 0) return [];
  const { data: posts, error: pErr } = await client.from("blog_posts")
    .select("id,title,slug,published_at").in("id", [...sessionByPost.keys()].map(Number))
    .not("published_at", "is", null).lte("published_at", new Date().toISOString());
  if (pErr) throw new Error(`could not load journal posts: ${pErr.message}`);
  return (posts ?? []).filter((p) => p.slug).map((p) => ({
    sessionId: sessionByPost.get(String(p.id))!,
    title: (p.title as string).trim(),
    slug: p.slug as string,
    publishedAt: p.published_at as string,
  }));
}

function guideLinks(loc: LibraryLocation, dbGuides: Awaited<ReturnType<typeof loadPublishedDbGuides>>): RelatedLink[] {
  const keys = [loc.row.location_key, ...loc.row.alias_keys].filter((k): k is string => !!k);
  const seen = new Set<string>();
  const out: RelatedLink[] = [];
  for (const guide of LOCATION_GUIDE_TYPES) {
    for (const key of keys) {
      const match = findGuideForPlace(guide, key, dbGuides);
      if (!match || seen.has(match.url)) continue;
      seen.add(match.url);
      out.push({ kind: "guide", label: `${GUIDE_LABEL[guide]} guide`, href: match.url });
    }
  }
  return out;
}

/** Related links per location id (guides for the place key, then newest journal posts). */
export async function loadRelatedContent(
  client: SupabaseClient, locations: readonly LibraryLocation[],
): Promise<Record<number, RelatedLink[]>> {
  const liveSessions = (loc: LibraryLocation) => loc.links.filter((l) => !l.excluded).map((l) => l.sessionId);
  const sessionIds = [...new Set(locations.flatMap(liveSessions))];
  const [dbGuides, posts] = await Promise.all([loadPublishedDbGuides(client), loadJournalPosts(client, sessionIds)]);
  const out: Record<number, RelatedLink[]> = {};
  for (const loc of locations) {
    const ids = new Set(liveSessions(loc));
    const journals = posts.filter((p) => ids.has(p.sessionId))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, MAX_JOURNAL_LINKS)
      .map((p): RelatedLink => ({ kind: "journal", label: p.title, href: `/blog/${p.slug}` }));
    out[loc.row.id] = [...guideLinks(loc, dbGuides), ...journals];
  }
  return out;
}
