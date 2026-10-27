// The location-library entry behind every Content Engine journal post, keyed
// by blog post id: the session's linked, non-excluded location when that
// location is published (active) on /bay-area-locations. Used for the "Keep
// exploring" link under a post, so a story about Shark Fin Cove points at the
// Shark Fin Cove guide — and only when that guide really exists publicly.
// Cached under the public-content tag like the other public reads.
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";
import { LOCATIONS_TABLE, LOCATION_SESSIONS_TABLE, PUBLIC_LOCATIONS_PATH } from "@/lib/locationLibrary/taxonomy";
import type { SiteLink } from "@/lib/blog/postService";

const ITEMS_TABLE = "session_content_items";
const JOURNAL_CONTENT_TYPE = "journal_post";
const PUBLISHED_STATUS = "published";
const BLOG_POST_TARGET = "blog_post";

type ItemRow = {
  published_target_id: string | null;
  session_content_packages: { photography_session_id: string | null } | null;
};

type LinkRow = {
  photography_session_id: string;
  excluded: boolean;
  bay_area_locations: { slug: string | null; title: string | null; active: boolean | null } | null;
};

/** The link for one published library location (pure). */
export function locationGuideLink(location: { slug: string; title: string }): SiteLink {
  return { label: `${location.title.trim()} photo location guide`, href: `${PUBLIC_LOCATIONS_PATH}#${location.slug}` };
}

/** post id → its session's published location guide, for sessions with exactly one usable place. */
export function linksFromRows(items: readonly ItemRow[], links: readonly LinkRow[]): Record<string, SiteLink> {
  const linkBySession = new Map<string, SiteLink | null>();
  for (const link of links) {
    const loc = link.bay_area_locations;
    if (link.excluded || !loc?.active || !loc.slug || !loc.title) continue;
    // Two published places for one session: no single guide to point at.
    linkBySession.set(link.photography_session_id, linkBySession.has(link.photography_session_id) ? null : locationGuideLink({ slug: loc.slug, title: loc.title }));
  }
  const entries = items.flatMap((row) => {
    const sessionId = row.session_content_packages?.photography_session_id;
    const link = sessionId ? linkBySession.get(sessionId) : null;
    return row.published_target_id && link ? [[row.published_target_id, link] as const] : [];
  });
  return Object.fromEntries(entries);
}

export const getJournalLocationLinksByPostId = cachePublicContent(async (): Promise<Record<string, SiteLink>> => {
  try {
    const client = createSupabaseServerClient();
    const { data: items, error } = await client
      .from(ITEMS_TABLE)
      .select("published_target_id, session_content_packages(photography_session_id)")
      .eq("content_type", JOURNAL_CONTENT_TYPE)
      .eq("status", PUBLISHED_STATUS)
      .eq("published_target_type", BLOG_POST_TARGET);
    if (error) {
      console.error("Failed to load journal items for location links", error);
      return {};
    }
    const sessionIds = [...new Set(((items ?? []) as unknown as ItemRow[])
      .map((r) => r.session_content_packages?.photography_session_id).filter((id): id is string => Boolean(id)))];
    if (sessionIds.length === 0) return {};
    const { data: links, error: lErr } = await client
      .from(LOCATION_SESSIONS_TABLE)
      .select(`photography_session_id, excluded, ${LOCATIONS_TABLE}(slug, title, active)`)
      .in("photography_session_id", sessionIds);
    if (lErr) {
      console.error("Failed to load journal location links", lErr);
      return {};
    }
    return linksFromRows((items ?? []) as unknown as ItemRow[], (links ?? []) as unknown as LinkRow[]);
  } catch (error) {
    console.error("Failed to load journal location links", error);
    return {};
  }
}, ["journal-location-links-by-post-id"]);
