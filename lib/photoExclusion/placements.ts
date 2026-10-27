// Server-only: finds the explicit placements excluded photos are still live
// in. One query per placement table for the whole batch (never one per
// photo); a failed read throws, so a partial answer is never shown as "none".
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gradSpotPlacement, guidePlacement, journalPlacement, locationHeroPlacement, portfolioPlacement,
  type LivePlacement,
} from "@/lib/photoExclusion/kinds";

export interface PlacedPhoto {
  id: string;
  /** The public web copy's URL — what every placement table stores. */
  url: string | null;
}

type Row = Record<string, unknown>;
/** URLs per `.in()` filter, so the request URL stays well under proxy limits. */
const IN_CHUNK = 100;
const GUIDE_TABLES = [
  ["couples_guide", "couples_location_photos"],
  ["family_guide", "family_location_photos"],
  ["portrait_guide", "portrait_location_photos"],
] as const;

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, label: string): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new Error(`could not read ${label}: ${error.message}`);
  return (data ?? []) as Row[];
}

function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += IN_CHUNK) out.push(list.slice(i, i + IN_CHUNK));
  return out;
}

async function journalRows(client: SupabaseClient, urls: string[]): Promise<Row[]> {
  const [covers, extras] = await Promise.all([
    rows(client.from("blog_posts").select("id,title,cover_image_url").in("cover_image_url", urls), "journal covers"),
    rows(client.from("blog_posts").select("id,title,extra_image_urls").overlaps("extra_image_urls", urls), "journal galleries"),
  ]);
  return [...covers, ...extras];
}

/** Photo ids whose URL a row names (a cover, or any gallery image). */
function photosOf(row: Row, byUrl: ReadonlyMap<string, string>): string[] {
  const urls = [row.cover_image_url, row.image_url, ...(Array.isArray(row.extra_image_urls) ? row.extra_image_urls : [])]
    .filter((u): u is string => typeof u === "string");
  return [...new Set(urls.map((u) => byUrl.get(u)).filter((id): id is string => id !== undefined))];
}

async function placementsForChunk(client: SupabaseClient, photos: readonly PlacedPhoto[]): Promise<LivePlacement[]> {
  const byUrl = new Map(photos.flatMap((p) => (p.url ? [[p.url, p.id] as const] : [])));
  const urls = [...byUrl.keys()];
  const ids = photos.map((p) => p.id);
  const [journal, portfolio, guides, spots, heroes] = await Promise.all([
    journalRows(client, urls),
    rows(client.from("portfolio_images").select("id,title,image_url").in("image_url", urls).eq("published", true), "portfolio"),
    Promise.all(GUIDE_TABLES.map(([, table]) =>
      rows(client.from(table).select("id,location_slug,image_url").in("image_url", urls).eq("published", true), table))),
    rows(client.from("location_spots").select("id,name,image_url").in("image_url", urls), "campus spots"),
    rows(client.from("bay_area_locations").select("id,title,featured_photo_id").in("featured_photo_id", ids), "location heroes"),
  ]);
  const out: LivePlacement[] = [];
  for (const r of journal) photosOf(r, byUrl).forEach((id) => out.push(journalPlacement(id, { id: String(r.id), title: r.title as string | null })));
  for (const r of portfolio) photosOf(r, byUrl).forEach((id) => out.push(portfolioPlacement(id, { id: String(r.id), title: r.title as string | null })));
  GUIDE_TABLES.forEach(([kind], i) => {
    for (const r of guides[i]) photosOf(r, byUrl).forEach((id) => out.push(guidePlacement(id, kind, { id: String(r.id), location_slug: String(r.location_slug) })));
  });
  for (const r of spots) photosOf(r, byUrl).forEach((id) => out.push(gradSpotPlacement(id, { id: String(r.id), name: r.name as string | null })));
  for (const r of heroes) out.push(locationHeroPlacement(String(r.featured_photo_id), { id: String(r.id), title: r.title as string | null }));
  // A post that uses a photo as its cover AND in its gallery is one placement.
  return out.filter((p, i) => out.findIndex((o) => o.photoId === p.photoId && o.kind === p.kind && o.ref === p.ref) === i);
}

/** Every explicit placement each photo is still live in, keyed by photo id (photos with none are absent). */
export async function listLivePlacements(client: SupabaseClient, photos: readonly PlacedPhoto[]): Promise<Map<string, LivePlacement[]>> {
  const out = new Map<string, LivePlacement[]>();
  for (const chunk of chunks(photos)) {
    for (const p of await placementsForChunk(client, chunk)) out.set(p.photoId, [...(out.get(p.photoId) ?? []), p]);
  }
  return out;
}

/** One photo's placements (its row is read here). */
export async function listPhotoPlacements(client: SupabaseClient, photoId: string): Promise<LivePlacement[]> {
  const { data, error } = await client.from("session_photos").select("id,public_derivative_url").eq("id", photoId).maybeSingle();
  if (error) throw new Error(`could not read the photo: ${error.message}`);
  if (!data) return [];
  const map = await listLivePlacements(client, [{ id: String(data.id), url: (data.public_derivative_url as string | null) ?? null }]);
  return map.get(photoId) ?? [];
}

/** Placements of every excluded photo of one session (or of all sessions), for a revoke or the review queue. */
export async function listExcludedPlacements(client: SupabaseClient, sessionId?: string): Promise<Map<string, LivePlacement[]>> {
  let query = client.from("session_photos").select("id,public_derivative_url").eq("excluded", true).not("public_derivative_url", "is", null);
  if (sessionId) query = query.eq("photography_session_id", sessionId);
  const photos = (await rows(query, "excluded photos")).map((r): PlacedPhoto => ({ id: String(r.id), url: (r.public_derivative_url as string | null) ?? null }));
  return listLivePlacements(client, photos);
}
