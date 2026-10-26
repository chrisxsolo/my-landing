// Service type of every blog post the Content Engine published, keyed by blog
// post id — read from the post's photography session, so it is authoritative
// even when a title doesn't name the service. Cached under the public-content
// tag, which the engine's publish/takedown routes already flush.
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";
import { normalizeServiceType, type ServiceType } from "@/lib/contentEngine/taxonomy";

const ITEMS_TABLE = "session_content_items";
const JOURNAL_CONTENT_TYPE = "journal_post";
const PUBLISHED_STATUS = "published";
const BLOG_POST_TARGET = "blog_post";

type Row = {
  published_target_id: string | null;
  session_content_packages: { photography_sessions: { service_type: string | null } | null } | null;
};

export const getJournalServicesByPostId = cachePublicContent(async (): Promise<Record<string, ServiceType>> => {
  try {
    const { data, error } = await createSupabaseServerClient()
      .from(ITEMS_TABLE)
      .select("published_target_id, session_content_packages(photography_sessions(service_type))")
      .eq("content_type", JOURNAL_CONTENT_TYPE)
      .eq("status", PUBLISHED_STATUS)
      .eq("published_target_type", BLOG_POST_TARGET);
    if (error) {
      console.error("Failed to load Content Engine journal services", error);
      return {};
    }
    const entries = ((data ?? []) as unknown as Row[]).flatMap((row) => {
      const service = normalizeServiceType(row.session_content_packages?.photography_sessions?.service_type);
      return row.published_target_id && service ? [[row.published_target_id, service] as const] : [];
    });
    return Object.fromEntries(entries);
  } catch (error) {
    console.error("Failed to load Content Engine journal services", error);
    return {};
  }
}, ["journal-services-by-post-id"]);
