// Server-only reads that assemble library locations with their sessions and
// derived photos. A fixed set of queries regardless of library size (rows,
// links, sessions, photos, overrides, places) — never one query per location.
// Every read is paged past PostgREST's row cap and throws on a failed page,
// so a large library is never silently cut short.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnownPlace } from "@/lib/locations/places";
import { loadKnownPlaces } from "@/lib/locations/registry";
import { fetchAllPages } from "@/lib/supabasePaging";
import {
  chooseHero, classifyPhotos, rankPublicPhotos,
  type ClassifiedPhoto, type HeroChoice, type MemberPhoto, type MemberSession, type OverrideMode,
} from "@/lib/locationLibrary/membership";
import { resolveSessionPlaces } from "@/lib/locationLibrary/syncPlan";
import {
  LOCATIONS_TABLE, LOCATION_SESSIONS_TABLE, PHOTO_OVERRIDES_TABLE,
  sessionKindsFor, sortKinds, type SessionKind,
} from "@/lib/locationLibrary/taxonomy";

/** Ids per `.in()` filter, so the request URL stays well under proxy limits. */
const IN_CHUNK = 200;

export interface LocationRow {
  id: number;
  title: string;
  slug: string;
  region: string;
  city: string;
  neighborhood: string | null;
  description: string;
  best_for: string;
  best_time: string;
  tip: string;
  tags: string[];
  environments: string[];
  /** Photographer-only (lib/photoConditions.ts); absent before the 20261026000006 migration. */
  light_tags?: string[];
  crowd_note?: string | null;
  image_url: string | null;
  order: number;
  active: boolean;
  needs_review: boolean;
  origin: "manual" | "engine";
  location_key: string | null;
  alias_keys: string[];
  featured_session_id: string | null;
  featured_photo_id: string | null;
  locked_fields: string[];
  ai_generated_at: string | null;
  ai_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedSession extends MemberSession {
  displayName: string;
  internalName: string | null;
  serviceType: string;
  relationshipType: string | null;
  primaryLocation: string | null;
  secondaryLocations: string[];
  startTime: string | null;
  lightingCondition: string | null;
  vibe: string | null;
  syncStatus: string | null;
  syncMessage: string | null;
  syncedAt: string | null;
  kinds: SessionKind[];
}

export interface LibraryPhoto extends MemberPhoto {
  storagePath: string;
  title: string | null;
  description: string | null;
  tags: string[];
}

export interface LocationLink {
  id: string;
  sessionId: string;
  source: "auto" | "manual";
  excluded: boolean;
}

export interface LibraryLocation {
  row: LocationRow;
  place: KnownPlace | null;
  links: LocationLink[];
  photos: (ClassifiedPhoto & LibraryPhoto)[];
  ranked: ClassifiedPhoto[];
  hero: HeroChoice | null;
  kinds: SessionKind[];
  sessionCount: number;
  publicPhotoCount: number;
}

export interface LoadedLibrary {
  locations: LibraryLocation[];
  sessions: Map<string, LinkedSession>;
  places: KnownPlace[];
}

export interface LoadOptions {
  ids?: number[];
  publishedOnly?: boolean;
}

type Row = Record<string, unknown>;
type PageQuery = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Every row matching an id list. Long lists are split so the request URL
 * stays short; each part is read page by page and a failed page throws.
 */
async function readIn(
  ids: readonly (string | number)[], label: string, page: (chunk: (string | number)[], from: number, to: number) => PageQuery,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    out.push(...await fetchAllPages<Row>((from, to) => page(chunk, from, to), label));
  }
  return out;
}

async function loadRows(client: SupabaseClient, opts: LoadOptions): Promise<LocationRow[]> {
  return fetchAllPages<LocationRow>((from, to) => {
    let q = client.from(LOCATIONS_TABLE).select("*").order("order").order("id");
    if (opts.ids) q = q.in("id", opts.ids);
    if (opts.publishedOnly) q = q.eq("active", true);
    return q.range(from, to);
  }, "library locations");
}

function toLibraryPhoto(p: Row): LibraryPhoto {
  return {
    id: p.id as string,
    sessionId: p.photography_session_id as string,
    storagePath: p.storage_path as string,
    publicUrl: (p.public_derivative_url as string | null) ?? null,
    excluded: !!p.excluded,
    qualityScore: (p.quality_score as number | null) ?? null,
    sortOrder: (p.sort_order as number) ?? 0,
    gpsLatitude: (p.gps_latitude as number | null) ?? null,
    gpsLongitude: (p.gps_longitude as number | null) ?? null,
    altText: (p.alt_text as string | null) ?? null,
    title: (p.title as string | null) ?? null,
    description: (p.description as string | null) ?? null,
    tags: (p.tags as string[] | null) ?? [],
  };
}

async function loadPhotos(client: SupabaseClient, sessionIds: string[]): Promise<LibraryPhoto[]> {
  const rows = await readIn(sessionIds, "session photos", (chunk, from, to) => client.from("session_photos")
    .select("id,photography_session_id,storage_path,public_derivative_url,excluded,quality_score,sort_order,gps_latitude,gps_longitude,alt_text,title,description,tags")
    .in("photography_session_id", chunk).order("id").range(from, to));
  return rows.map(toLibraryPhoto);
}

function toSession(s: Record<string, unknown>, places: readonly KnownPlace[]): LinkedSession {
  const primaryLocation = (s.primary_location as string | null) ?? null;
  const secondaryLocations = (s.secondary_locations as string[] | null) ?? [];
  const resolved = resolveSessionPlaces(
    { id: s.id as string, primaryLocation, secondaryLocations, schoolSlug: (s.school_slug as string | null) ?? null, gps: null, approved: true },
    places,
  );
  const name = (s.public_display_name as string | null)?.trim() || "Untitled session";
  return {
    id: s.id as string,
    displayName: name,
    internalName: (s.internal_client_name as string | null) ?? null,
    permissionOk: !!s.marketing_permission && !s.marketing_permission_revoked_at,
    multiLocation: resolved.places.length + resolved.unresolved.length > 1,
    sessionDate: (s.session_date as string | null) ?? null,
    serviceType: s.service_type as string,
    relationshipType: (s.relationship_type as string | null) ?? null,
    primaryLocation, secondaryLocations,
    startTime: (s.start_time as string | null) ?? null,
    lightingCondition: (s.lighting_condition as string | null) ?? null,
    vibe: (s.vibe as string | null) ?? null,
    syncStatus: (s.location_sync_status as string | null) ?? null,
    syncMessage: (s.location_sync_message as string | null) ?? null,
    syncedAt: (s.location_synced_at as string | null) ?? null,
    kinds: sessionKindsFor(s.service_type as string, (s.relationship_type as string | null) ?? null),
  };
}

export const SESSION_COLUMNS =
  "id,public_display_name,internal_client_name,service_type,relationship_type,primary_location,secondary_locations,school_slug," +
  "session_date,start_time,lighting_condition,vibe,marketing_permission,marketing_permission_revoked_at," +
  "location_sync_status,location_sync_message,location_synced_at";

function placeFor(row: LocationRow, places: readonly KnownPlace[]): KnownPlace | null {
  if (!row.location_key) return null;
  return places.find((p) => p.key === row.location_key) ?? null;
}

function assemble(
  row: LocationRow, links: LocationLink[], sessions: Map<string, LinkedSession>,
  photosBySession: Map<string, LibraryPhoto[]>, overrides: Map<string, OverrideMode>, place: KnownPlace | null,
): LibraryLocation {
  const live = links.filter((l) => !l.excluded && sessions.has(l.sessionId));
  const liveSessions = new Map(live.map((l) => [l.sessionId, sessions.get(l.sessionId)!]));
  const pool = live.flatMap((l) => photosBySession.get(l.sessionId) ?? []);
  const photos = classifyPhotos(pool, liveSessions, place, overrides) as (ClassifiedPhoto & LibraryPhoto)[];
  const ranked = rankPublicPhotos(photos, liveSessions);
  const kinds = sortKinds([...liveSessions.values()].filter((s) => s.permissionOk).flatMap((s) => s.kinds));
  return {
    row, place, links, photos, ranked, kinds,
    hero: chooseHero({
      featuredPhotoId: row.featured_photo_id,
      featuredSessionId: row.featured_session_id,
      manualImageUrl: row.image_url,
    }, ranked),
    sessionCount: liveSessions.size,
    publicPhotoCount: ranked.length,
  };
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) out.set(key(item), [...(out.get(key(item)) ?? []), item]);
  return out;
}

export async function loadLibraryLocations(client: SupabaseClient, opts: LoadOptions = {}): Promise<LoadedLibrary> {
  const [rows, places] = await Promise.all([loadRows(client, opts), loadKnownPlaces(client)]);
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return { locations: [], sessions: new Map(), places };

  const [linkData, overrides] = await Promise.all([
    readIn(ids, "location links", (chunk, from, to) => client.from(LOCATION_SESSIONS_TABLE)
      .select("id,location_id,photography_session_id,source,excluded").in("location_id", chunk).order("id").range(from, to)),
    readIn(ids, "photo overrides", (chunk, from, to) => client.from(PHOTO_OVERRIDES_TABLE)
      .select("location_id,session_photo_id,mode").in("location_id", chunk)
      .order("location_id").order("session_photo_id").range(from, to)),
  ]);
  const links = linkData.map((l) => ({
    id: l.id as string, locationId: l.location_id as number, sessionId: l.photography_session_id as string,
    source: l.source as "auto" | "manual", excluded: !!l.excluded,
  }));

  const sessionIds = [...new Set(links.map((l) => l.sessionId))];
  const [sessionRows, photos] = await Promise.all([
    readIn(sessionIds, "sessions", (chunk, from, to) => client.from("photography_sessions")
      .select(SESSION_COLUMNS).in("id", chunk).order("id").range(from, to)),
    loadPhotos(client, sessionIds),
  ]);
  const sessions = new Map(sessionRows.map((s) => [s.id as string, toSession(s, places)]));
  const photosBySession = groupBy(photos, (p) => p.sessionId);
  const linksByLocation = groupBy(links, (l) => l.locationId);
  const overridesByLocation = groupBy(overrides, (o) => o.location_id as number);

  const locations = rows.map((row) => assemble(
    row, linksByLocation.get(row.id) ?? [], sessions, photosBySession,
    new Map((overridesByLocation.get(row.id) ?? []).map((o) => [o.session_photo_id as string, o.mode as OverrideMode])),
    placeFor(row, places),
  ));
  return { locations, sessions, places };
}
