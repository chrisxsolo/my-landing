// Server-only shapes for the admin Locations section: the overview table, the
// sync panel, and one location's full detail (sessions + photo thumbnails).
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";
import { publicThumbUrl } from "@/lib/guidePhotoLibrary/load";
import { loadLibraryLocations, SESSION_COLUMNS, type LibraryLocation, type LinkedSession, type LocationRow } from "@/lib/locationLibrary/load";
import { rowForKey } from "@/lib/locationLibrary/syncPlan";
import { loadRelatedContent, type RelatedLink } from "@/lib/locationLibrary/related";
import type { PhotoState } from "@/lib/locationLibrary/membership";
import { fetchAllPages } from "@/lib/supabasePaging";

const THUMB_WIDTH = 360;
const THUMB_TTL_SECONDS = 3600;

export type LocationStatus = "published" | "review" | "unpublished";

export interface LocationSummaryDto {
  id: number;
  title: string;
  slug: string;
  city: string;
  region: string;
  environments: string[];
  kinds: string[];
  locationKey: string | null;
  sessionCount: number;
  photoCount: number;
  status: LocationStatus;
  heroUrl: string | null;
  heroSource: "featured_photo" | "manual_image" | "auto" | null;
  origin: string;
  createdAt: string;
  aiError: string | null;
}

export interface SyncSessionDto {
  id: string;
  name: string;
  serviceType: string;
  location: string | null;
  status: string | null;
  message: string | null;
  syncedAt: string | null;
  locations: { id: number; title: string }[];
}

export interface PlaceOptionDto {
  key: string;
  name: string;
  city: string;
  hasLocation: boolean;
}

export function statusOf(row: Pick<LocationRow, "active" | "needs_review">): LocationStatus {
  if (row.active) return "published";
  return row.needs_review ? "review" : "unpublished";
}

function summary(loc: LibraryLocation): LocationSummaryDto {
  const r = loc.row;
  return {
    id: r.id, title: r.title.trim(), slug: r.slug, city: r.city.trim(), region: r.region,
    environments: r.environments, kinds: loc.kinds, locationKey: r.location_key,
    sessionCount: loc.sessionCount, photoCount: loc.publicPhotoCount, status: statusOf(r),
    heroUrl: loc.hero ? publicThumbUrl(loc.hero.url, THUMB_WIDTH) : null,
    heroSource: loc.hero?.source ?? null, origin: r.origin, createdAt: r.created_at, aiError: r.ai_error,
  };
}

async function loadSyncSessions(client: SupabaseClient, locations: LibraryLocation[]): Promise<SyncSessionDto[]> {
  const data = await fetchAllPages((from, to) => client.from("photography_sessions").select(SESSION_COLUMNS)
    .order("created_at", { ascending: false }).order("id").range(from, to), "sessions");
  const bySession = new Map<string, { id: number; title: string }[]>();
  for (const loc of locations) {
    for (const link of loc.links.filter((l) => !l.excluded)) {
      bySession.set(link.sessionId, [...(bySession.get(link.sessionId) ?? []), { id: loc.row.id, title: loc.row.title.trim() }]);
    }
  }
  return data.map((s) => ({
    id: s.id as string,
    name: (s.public_display_name as string | null)?.trim() || (s.internal_client_name as string | null)?.trim() || "Untitled session",
    serviceType: s.service_type as string,
    location: [s.primary_location, ...((s.secondary_locations as string[] | null) ?? [])].filter(Boolean).join(" · ") || null,
    status: (s.location_sync_status as string | null) ?? null,
    message: (s.location_sync_message as string | null) ?? null,
    syncedAt: (s.location_synced_at as string | null) ?? null,
    locations: bySession.get(s.id as string) ?? [],
  }));
}

export async function loadAdminOverview(client: SupabaseClient) {
  const lib = await loadLibraryLocations(client);
  const sessions = await loadSyncSessions(client, lib.locations);
  const rows = lib.locations.map((l) => ({ id: l.row.id, locationKey: l.row.location_key, aliasKeys: l.row.alias_keys }));
  const places: PlaceOptionDto[] = lib.places
    .map((p) => ({ key: p.key, name: p.name, city: p.city, hasLocation: !!rowForKey(rows, p.key) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lastSyncedAt = sessions.map((s) => s.syncedAt).filter((d): d is string => !!d).sort().at(-1) ?? null;
  return { locations: lib.locations.map(summary), sessions, places, lastSyncedAt };
}

export interface DetailPhotoDto {
  id: string;
  sessionId: string;
  thumbUrl: string | null;
  state: PhotoState;
  qualityScore: number | null;
  alt: string | null;
}

export interface DetailSessionDto {
  id: string;
  name: string;
  serviceType: string;
  kinds: string[];
  date: string | null;
  location: string | null;
  source: "auto" | "manual";
  excluded: boolean;
  permissionOk: boolean;
  multiLocation: boolean;
  /** The session's recorded lighting (Content Engine value, e.g. "golden_hour"). */
  lighting: string | null;
  photos: DetailPhotoDto[];
}

async function thumbFor(client: SupabaseClient, publicUrl: string | null, storagePath: string): Promise<string | null> {
  if (publicUrl) return publicThumbUrl(publicUrl, THUMB_WIDTH);
  const { data, error } = await client.storage.from(ORIGINALS_BUCKET)
    .createSignedUrl(storagePath, THUMB_TTL_SECONDS, { transform: { width: THUMB_WIDTH, resize: "contain", quality: 70 } });
  if (error) console.error(`[location-library] thumbnail sign failed for ${storagePath}`, error.message);
  return data?.signedUrl ?? null;
}

function sessionDto(s: LinkedSession, link: LibraryLocation["links"][number], photos: DetailPhotoDto[]): DetailSessionDto {
  return {
    id: s.id, name: s.internalName?.trim() || s.displayName, serviceType: s.serviceType, kinds: s.kinds,
    date: s.sessionDate, location: [s.primaryLocation, ...s.secondaryLocations].filter(Boolean).join(" · ") || null,
    source: link.source, excluded: link.excluded, permissionOk: s.permissionOk, multiLocation: s.multiLocation, lighting: s.lightingCondition, photos,
  };
}

export async function loadAdminDetail(client: SupabaseClient, id: number) {
  const lib = await loadLibraryLocations(client, { ids: [id] });
  const loc = lib.locations[0];
  if (!loc) return null;
  const photos = await Promise.all(loc.photos.map(async (p): Promise<DetailPhotoDto> => ({
    id: p.id, sessionId: p.sessionId, thumbUrl: await thumbFor(client, p.publicUrl, p.storagePath),
    state: p.state, qualityScore: p.qualityScore, alt: p.altText,
  })));
  const order = (a: DetailPhotoDto, b: DetailPhotoDto) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
  const sessions = loc.links
    .filter((l) => lib.sessions.has(l.sessionId))
    .map((l) => sessionDto(lib.sessions.get(l.sessionId)!, l, photos.filter((p) => p.sessionId === l.sessionId).sort(order)));
  const related: RelatedLink[] = (await loadRelatedContent(client, [loc], { includeUnpublished: true }))[loc.row.id] ?? [];
  return {
    location: summary(loc),
    row: loc.row,
    place: loc.place ? { key: loc.place.key, name: loc.place.name, city: loc.place.city, county: loc.place.county } : null,
    hero: loc.hero ? { ...loc.hero, thumbUrl: publicThumbUrl(loc.hero.url, THUMB_WIDTH) } : null,
    sessions,
    related,
  };
}
