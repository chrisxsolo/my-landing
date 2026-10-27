// Server-only: loads the review findings that are not about one photo's tags
// — excluded photos still placed by hand, sessions whose location or school
// is unresolved, and proposed places waiting in review. Each read is
// settled on its own: a failed read is reported in `errors` and never hides
// the others as "nothing to review".
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicThumbUrl } from "@/lib/guidePhotoLibrary/load";
import { LOCATIONS_TABLE, LOCATION_SESSIONS_TABLE } from "@/lib/locationLibrary/taxonomy";
import { listExcludedPlacements } from "@/lib/photoExclusion/placements";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { loadReviews } from "@/lib/photoTagging/reviews";
import { enginePhotoKey, SESSION_PHOTOS_TABLE } from "@/lib/photoTagging/types";
import type {
  ExcludedLiveFinding, ProposedPlaceFinding, ReviewFindings, SessionFinding,
} from "@/lib/reviewQueue/findingItems";

type Row = Record<string, unknown>;
const THUMB_WIDTH = 160;
const SESSIONS_TABLE = "photography_sessions";
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function settle<T>(label: string, errors: string[], fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const message = `${label}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[review-queue] ${message}`);
    errors.push(message);
    return fallback;
  }
}

async function excludedLive(client: SupabaseClient, sessionId?: string): Promise<ExcludedLiveFinding[]> {
  const placements = await listExcludedPlacements(client, sessionId);
  if (placements.size === 0) return [];
  const ids = [...placements.keys()];
  const [photos, reviews] = await Promise.all([
    rows(client.from(SESSION_PHOTOS_TABLE)
      .select("id,public_derivative_url,updated_at,photography_sessions!inner(id,public_display_name,school_slug)").in("id", ids)),
    loadReviews(client, ids.map(enginePhotoKey)),
  ]);
  return photos.flatMap((p): ExcludedLiveFinding[] => {
    const s = p.photography_sessions as Row | Row[] | null;
    const session = Array.isArray(s) ? s[0] : s;
    const url = text(p.public_derivative_url);
    if (!session || !url) return [];
    return [{
      photoId: String(p.id), sessionId: String(session.id), sessionName: text(session.public_display_name),
      schoolSlug: text(session.school_slug), url: publicThumbUrl(url, THUMB_WIDTH),
      placements: placements.get(String(p.id)) ?? [], dismissed: reviews.get(enginePhotoKey(String(p.id)))?.dismissed ?? [],
      excludedAt: text(p.updated_at),
    }];
  });
}

const SESSION_COLUMNS = "id,public_display_name,internal_client_name,service_type,school_slug,primary_location,secondary_locations,"
  + "location_sync_status,location_sync_message,created_at";

/** Sessions needing review: unresolved location or a graduation with no school. */
async function sessions(client: SupabaseClient, entries: readonly LibraryEntry[], sessionId?: string): Promise<SessionFinding[]> {
  let query = client.from(SESSIONS_TABLE).select(SESSION_COLUMNS)
    .or("location_sync_status.in.(needs_review,error),and(service_type.eq.grads,school_slug.is.null)")
    .order("created_at", { ascending: false });
  if (sessionId) query = query.eq("id", sessionId);
  return (await rows(query)).map((s): SessionFinding => {
    const id = String(s.id);
    const mine = entries.filter((e) => e.photo.sessionId === id);
    const withSchool = mine.find((e) => e.photo.suggestions.some((x) => x.field === "school" && x.appliesTo === "session"));
    return {
      id, name: text(s.public_display_name) ?? text(s.internal_client_name) ?? "Untitled session",
      serviceType: String(s.service_type), schoolSlug: text(s.school_slug),
      location: [s.primary_location, ...((s.secondary_locations as string[] | null) ?? [])].filter(Boolean).join(" · ") || null,
      syncStatus: text(s.location_sync_status), syncMessage: text(s.location_sync_message), createdAt: String(s.created_at),
      schoolSuggestions: withSchool?.photo.suggestions.filter((x) => x.field === "school" && x.appliesTo === "session") ?? [],
      url: mine.find((e) => e.photo.url)?.photo.url ?? null,
      photoKey: withSchool?.photo.key ?? mine[0]?.photo.key ?? null,
    };
  });
}

async function proposedPlaces(client: SupabaseClient): Promise<ProposedPlaceFinding[]> {
  const places = await rows(client.from(LOCATIONS_TABLE)
    .select("id,title,slug,city,region,origin,description,image_url,created_at").eq("needs_review", true).order("created_at", { ascending: false }));
  if (places.length === 0) return [];
  const links = await rows(client.from(LOCATION_SESSIONS_TABLE).select("location_id").in("location_id", places.map((p) => p.id)).eq("excluded", false));
  const counts = new Map<number, number>();
  for (const l of links) counts.set(Number(l.location_id), (counts.get(Number(l.location_id)) ?? 0) + 1);
  return places.map((p) => ({
    id: Number(p.id), title: String(p.title).trim(), slug: String(p.slug), city: String(p.city), region: String(p.region),
    origin: String(p.origin), hasDescription: Boolean(text(p.description)), sessionCount: counts.get(Number(p.id)) ?? 0,
    createdAt: String(p.created_at), heroUrl: text(p.image_url) ? publicThumbUrl(String(p.image_url), THUMB_WIDTH) : null,
  }));
}

/** Findings for the whole library, or one session's (proposed places are library-wide and skipped then). */
export async function loadReviewFindings(
  client: SupabaseClient, entries: readonly LibraryEntry[], sessionId?: string,
): Promise<ReviewFindings> {
  const errors: string[] = [];
  const [excluded, sess, places] = await Promise.all([
    settle("excluded photos", errors, [] as ExcludedLiveFinding[], () => excludedLive(client, sessionId)),
    settle("sessions", errors, [] as SessionFinding[], () => sessions(client, entries, sessionId)),
    sessionId ? Promise.resolve([] as ProposedPlaceFinding[]) : settle("proposed places", errors, [] as ProposedPlaceFinding[], () => proposedPlaces(client)),
  ]);
  return { excludedLive: excluded, sessions: sess, proposedPlaces: places, errors };
}
