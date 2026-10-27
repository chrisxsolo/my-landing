// Server-only reads for the "Choose existing photo" picker: the Content Engine
// library (session_photos + photography_sessions), the target gallery's rows,
// and thumbnails for one page of results. Never writes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";
import { PUBLIC_IMAGE_WEB_COPIES } from "@/lib/imageWebCopies";
import { SPOT_SCHOOL_IDS } from "@/lib/contentEngine/taxonomy";
import { COUPLES_LOCATION_PHOTOS_TABLE, isValidCouplesLocationSlug } from "@/lib/couplesPhotosAdmin";
import { FAMILY_LOCATION_PHOTOS_TABLE, isValidFamilyLocationSlug } from "@/lib/familyPhotosAdmin";
import { PORTRAIT_LOCATION_PHOTOS_TABLE, isValidPortraitLocationSlug } from "@/lib/portraitPhotosAdmin";
import { loadKnownPlaces } from "@/lib/locations/registry";
import { matchPlacesByName, normalizePlaceName } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { fetchAllPages } from "@/lib/supabasePaging";
import type { GuideTarget, LibraryPhoto, LibrarySession, LibraryTarget, RankedPhoto } from "@/lib/guidePhotoLibrary/rank";

export const GUIDE_PHOTO_TABLE: Record<GuideTarget, string> = {
  couples: COUPLES_LOCATION_PHOTOS_TABLE,
  family: FAMILY_LOCATION_PHOTOS_TABLE,
  portrait: PORTRAIT_LOCATION_PHOTOS_TABLE,
};

const VALID_GUIDE_SLUG: Record<GuideTarget, (slug: unknown) => boolean> = {
  couples: isValidCouplesLocationSlug,
  family: isValidFamilyLocationSlug,
  portrait: isValidPortraitLocationSlug,
};

export function isValidGuideSlug(guide: GuideTarget, slug: unknown): slug is string {
  return VALID_GUIDE_SLUG[guide](slug);
}

/** location_spots.school_id ("berkeley") → engine school slug ("uc-berkeley"). */
export function engineSchoolForSpot(spotSchoolId: string): string | null {
  const hit = Object.entries(SPOT_SCHOOL_IDS).find(([, id]) => id === spotSchoolId);
  return hit ? hit[0] : null;
}

const THUMB_WIDTH = 480;
const THUMB_TTL_SECONDS = 3600;

interface SessionRow {
  id: string;
  public_display_name: string | null;
  internal_client_name: string | null;
  service_type: string;
  school_slug: string | null;
  primary_location: string | null;
  secondary_locations: string[] | null;
  session_date: string | null;
  marketing_permission: boolean;
  marketing_permission_revoked_at: string | null;
}

export interface PhotoRow {
  id: string;
  photography_session_id: string;
  storage_path: string;
  public_derivative_url: string | null;
  excluded: boolean;
  quality_score: number | null;
  sort_order: number;
  alt_text: string | null;
}

function sessionName(row: SessionRow): string {
  const name = row.public_display_name?.trim() || row.internal_client_name?.trim() || "Untitled session";
  return row.session_date ? `${name} · ${row.session_date}` : name;
}

function placesForText(text: string, places: readonly KnownPlace[]): KnownPlace[] {
  const parts = [text, ...text.split(/,|\/|\s+and\s+|&/i)].map((p) => p.trim()).filter(Boolean);
  const hits = new Map<string, KnownPlace>();
  for (const part of parts) for (const p of matchPlacesByName(part, places)) hits.set(p.key, p);
  return [...hits.values()];
}

export function toLibrarySession(row: SessionRow, places: readonly KnownPlace[]): LibrarySession {
  const texts = [row.primary_location, ...(row.secondary_locations ?? [])].filter((t): t is string => !!t?.trim());
  const matched = texts.flatMap((t) => placesForText(t, places));
  const placeKeys = [...new Set(matched.map((p) => p.key))];
  const primaryText = row.primary_location?.trim() || null;
  const first = matched[0] ?? null;
  return {
    id: row.id,
    name: sessionName(row),
    serviceType: row.service_type,
    schoolSlug: row.school_slug,
    placeKeys,
    locationKey: first ? first.key : primaryText ? `text:${normalizePlaceName(primaryText)}` : null,
    locationLabel: first ? first.name : primaryText,
    permissionOk: row.marketing_permission && !row.marketing_permission_revoked_at,
  };
}

// Paged past PostgREST's row cap; a failed page throws. Stopping on a short
// page would end early whenever the server caps lower than the page size.
function loadAllPhotos(client: SupabaseClient): Promise<PhotoRow[]> {
  return fetchAllPages<PhotoRow>((from, to) => client.from("session_photos")
    .select("id,photography_session_id,storage_path,public_derivative_url,excluded,quality_score,sort_order,alt_text")
    .order("created_at").order("id").range(from, to), "session photos");
}

// Every session: a photo whose session is missing would drop out of the picker.
function loadAllSessions(client: SupabaseClient): Promise<SessionRow[]> {
  return fetchAllPages<SessionRow>((from, to) => client.from("photography_sessions")
    .select("id,public_display_name,internal_client_name,service_type,school_slug,primary_location,secondary_locations,session_date,marketing_permission,marketing_permission_revoked_at")
    .order("id").range(from, to), "sessions");
}

async function loadGuideRows(client: SupabaseClient, target: LibraryTarget) {
  const byUrl = new Map<string, { rowId: string; published: boolean; hero: boolean }>();
  if (target.kind !== "guide") return byUrl;
  const { data, error } = await client.from(GUIDE_PHOTO_TABLE[target.guide])
    .select("id,image_url,published,featured").eq("location_slug", target.slug);
  if (error) throw new Error(`could not load the guide gallery: ${error.message}`);
  for (const r of data ?? []) {
    byUrl.set(r.image_url as string, { rowId: r.id as string, published: !!r.published, hero: !!r.featured });
  }
  return byUrl;
}

export interface LoadedLibrary {
  sessions: Map<string, LibrarySession>;
  photos: LibraryPhoto[];
  rows: Map<string, PhotoRow>;
}

export async function loadLibrary(client: SupabaseClient, target: LibraryTarget): Promise<LoadedLibrary> {
  const [sessionRows, photoRows, guideRows, places] = await Promise.all([
    loadAllSessions(client),
    loadAllPhotos(client),
    loadGuideRows(client, target),
    loadKnownPlaces(client),
  ]);

  const sessions = new Map(sessionRows.map((s) => [s.id, toLibrarySession(s, places)]));
  const photos: LibraryPhoto[] = photoRows.map((p) => ({
    id: p.id,
    sessionId: p.photography_session_id,
    hasDerivative: !!p.public_derivative_url,
    excluded: p.excluded,
    qualityScore: p.quality_score,
    sortOrder: p.sort_order,
    inGuide: p.public_derivative_url ? guideRows.get(p.public_derivative_url) ?? null : null,
  }));
  return { sessions, photos, rows: new Map(photoRows.map((p) => [p.id, p])) };
}

const OBJECT_PREFIX = "/storage/v1/object/public/";
const RENDER_PREFIX = "/storage/v1/render/image/public/";

/**
 * Supabase render URL for a public object (same transform the site's image
 * loader uses, including the web copies that stand in for originals too big
 * to transform). Never the full-resolution original.
 */
export function publicThumbUrl(publicUrl: string, width = THUMB_WIDTH): string {
  try {
    const url = new URL(publicUrl);
    if (!url.pathname.startsWith(OBJECT_PREFIX)) return publicUrl;
    const storagePath = url.pathname.slice(OBJECT_PREFIX.length);
    url.pathname = RENDER_PREFIX + (PUBLIC_IMAGE_WEB_COPIES[storagePath] ?? storagePath);
    url.searchParams.set("width", String(width));
    url.searchParams.set("quality", "70");
    url.searchParams.set("resize", "contain");
    return url.toString();
  } catch {
    return publicUrl;
  }
}

export type PickerSource = "engine" | "portfolio" | "journal";

export interface PickerPhoto {
  id: string;
  /** engine = Content Engine photo (uuid id); portfolio / journal = extraSources.ts. */
  source: PickerSource;
  sessionId: string;
  sessionName: string;
  serviceType: string;
  /** /grads school slug, when known. */
  schoolSlug: string | null;
  locationLabel: string | null;
  thumbUrl: string | null;
  webUrl: string | null;
  alt: string | null;
  status: RankedPhoto["status"];
  tier: number;
  excluded: boolean;
  qualityScore: number | null;
  inGuide: RankedPhoto["inGuide"];
  /** Where the photo comes from, for non-engine sources ("Journal · <post>"). */
  originLabel: string | null;
  /** Public pages showing the photo now (lib/photoSync/placements countLivePages); null = not counted. */
  usedOnPages: number | null;
}

/** Shapes one page for the client; private originals get short-lived signed thumbnails. */
export async function toPickerPhotos(
  client: SupabaseClient, page: RankedPhoto[], lib: LoadedLibrary,
): Promise<PickerPhoto[]> {
  return Promise.all(page.map(async (p) => {
    const row = lib.rows.get(p.id)!;
    const session = lib.sessions.get(p.sessionId)!;
    let thumbUrl: string | null = null;
    if (row.public_derivative_url) {
      thumbUrl = publicThumbUrl(row.public_derivative_url);
    } else {
      const { data, error } = await client.storage.from(ORIGINALS_BUCKET)
        .createSignedUrl(row.storage_path, THUMB_TTL_SECONDS, { transform: { width: THUMB_WIDTH, resize: "contain", quality: 70 } });
      if (error) console.error(`[guide-photo-library] thumbnail sign failed for ${p.id}`, error.message);
      thumbUrl = data?.signedUrl ?? null;
    }
    return {
      id: p.id,
      source: "engine",
      sessionId: p.sessionId,
      sessionName: session.name,
      serviceType: session.serviceType,
      schoolSlug: session.schoolSlug,
      locationLabel: session.locationLabel,
      thumbUrl,
      webUrl: row.public_derivative_url,
      alt: row.alt_text,
      status: p.status,
      tier: p.tier,
      excluded: p.excluded,
      qualityScore: p.qualityScore,
      inGuide: p.inGuide,
      originLabel: null,
      usedOnPages: null,
    };
  }));
}
