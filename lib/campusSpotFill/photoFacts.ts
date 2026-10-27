// Photo-level facts for the campus-spot matcher, read straight from
// session_photos and portfolio_images. Server-only.
//
//   • photoLocation — the photo's own confirmed location
//     (session_photos.photo_location, manual or GPS-matched), else the
//     Portfolio photo's location tag. Never the session's location.
//   • gpsPlace      — the known place the photo's own GPS falls inside
//   • blocked       — why the photo must not appear publicly (excluded in the
//     Content Engine, its session's marketing permission off or revoked,
//     unpublished in the Portfolio). Checked again here because a photo
//     placed on a school page explicitly (school_page_photos) carries no
//     permission check of its own.
//
// Every read is paged (lib/supabasePaging) and throws on a failed page, so an
// incomplete read aborts the sync instead of looking like "no longer public".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhotoLocationFact } from "@/lib/campusSpotFill/evidence";
import { matchPlacesByName, placeAtCoordinates } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { fetchAllPages } from "@/lib/supabasePaging";

export const SESSION_PHOTOS_TABLE = "session_photos";
export const PORTFOLIO_IMAGES_TABLE = "portfolio_images";

export interface PhotoFact {
  photoLocation: PhotoLocationFact | null;
  gpsPlace: { key: string; name: string } | null;
  /** Why the photo must not appear publicly, else null. */
  blocked: string | null;
}

/** Facts per public photo URL (Portfolio URL or Content Engine derivative URL). */
export type PhotoFacts = ReadonlyMap<string, PhotoFact>;

type Row = Record<string, unknown>;

const ENGINE_COLUMNS = "id,public_derivative_url,content_hash,excluded,photo_location,photo_location_source,"
  + "gps_latitude,gps_longitude,photography_sessions!inner(marketing_permission,marketing_permission_revoked_at)";
const PORTFOLIO_COLUMNS = "id,image_url,content_hash,location,published";

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function placeKeyOf(location: string, places: readonly KnownPlace[]): string | null {
  const hits = matchPlacesByName(location, places);
  return hits.length === 1 ? hits[0].key : null;
}

function engineBlocked(row: Row): string | null {
  if (row.excluded === true) return "excluded in the Content Engine";
  const session = one(row.photography_sessions as Row | Row[] | null);
  const ok = session?.marketing_permission === true && !session.marketing_permission_revoked_at;
  return ok ? null : "session is not cleared for marketing";
}

function engineFact(row: Row, places: readonly KnownPlace[]): PhotoFact {
  const location = text(row.photo_location);
  const source = row.photo_location_source === "gps" ? "gps" : "manual";
  const lat = num(row.gps_latitude);
  const lng = num(row.gps_longitude);
  const gps = lat !== null && lng !== null ? placeAtCoordinates({ latitude: lat, longitude: lng }, places)?.place ?? null : null;
  return {
    photoLocation: location ? { text: location, source, placeKey: placeKeyOf(location, places) } : null,
    gpsPlace: gps ? { key: gps.key, name: gps.name } : null,
    blocked: engineBlocked(row),
  };
}

function portfolioFact(row: Row, engine: PhotoFact | null, places: readonly KnownPlace[]): PhotoFact {
  const tag = text(row.location);
  const photoLocation = engine?.photoLocation
    ?? (tag ? { text: tag, source: "tag" as const, placeKey: placeKeyOf(tag, places) } : null);
  const blocked = row.published === false ? "unpublished in the Portfolio" : engine?.blocked ?? null;
  return { photoLocation, gpsPlace: engine?.gpsPlace ?? null, blocked };
}

/**
 * Pure: facts per URL. A Portfolio photo is linked to its Content Engine photo
 * the way the public pool links them (derivative URL, then original hash).
 */
export function buildPhotoFacts(engineRows: readonly Row[], portfolioRows: readonly Row[], places: readonly KnownPlace[]): Map<string, PhotoFact> {
  const out = new Map<string, PhotoFact>();
  const byHash = new Map<string, PhotoFact>();
  for (const row of engineRows) {
    const url = text(row.public_derivative_url);
    if (!url) continue;
    const fact = engineFact(row, places);
    out.set(url, fact);
    const hash = text(row.content_hash);
    if (hash && !byHash.has(hash)) byHash.set(hash, fact);
  }
  for (const row of portfolioRows) {
    const url = text(row.image_url);
    if (!url) continue;
    const hash = text(row.content_hash);
    const engine = out.get(url) ?? (hash ? byHash.get(hash) ?? null : null);
    out.set(url, portfolioFact(row, engine, places));
  }
  return out;
}

/** Every public photo's facts. Throws if any page fails. */
export async function loadPhotoFacts(client: SupabaseClient, places: readonly KnownPlace[]): Promise<Map<string, PhotoFact>> {
  const [engine, portfolio] = await Promise.all([
    fetchAllPages<Row>((from, to) => client.from(SESSION_PHOTOS_TABLE).select(ENGINE_COLUMNS)
      .not("public_derivative_url", "is", null).order("id").range(from, to), "session photo facts"),
    fetchAllPages<Row>((from, to) => client.from(PORTFOLIO_IMAGES_TABLE).select(PORTFOLIO_COLUMNS)
      .order("id").range(from, to), "portfolio photo facts"),
  ]);
  return buildPhotoFacts(engine, portfolio, places);
}

/**
 * Render-time check for a handful of URLs (the automatic spot photos): the
 * ones whose Content Engine photo is excluded or whose session lost marketing
 * permission, with the reason. Throws on a failed read.
 */
export async function loadBlockedUrls(client: SupabaseClient, urls: readonly string[]): Promise<Map<string, string>> {
  if (urls.length === 0) return new Map();
  const rows = await fetchAllPages<Row>((from, to) => client.from(SESSION_PHOTOS_TABLE).select(ENGINE_COLUMNS)
    .in("public_derivative_url", [...urls]).order("id").range(from, to), "spot photo permissions");
  return new Map(rows.flatMap((row) => {
    const reason = engineBlocked(row);
    const url = text(row.public_derivative_url);
    return reason && url ? [[url, reason] as const] : [];
  }));
}
