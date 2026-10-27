// Loads every photo that is already public, plus the facts needed to place
// it: its Content Engine session (school, location, permission, exclusion),
// explicit school-page placements, Content Engine photos already live in a
// published journal post, known places, live guide pages, the admin's
// per-page curation, and campus-spot tags. Server-only.
//
// loadPhotoPool is uncached (admin reads it right after writing).
// getPhotoPool is the public, cached copy under the shared public-content tag,
// so every existing publish / takedown / portfolio save already refreshes it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { cachePublicContent } from "@/lib/publicContentCache";
import { getPhotoAlt, getPhotoTitle, normalizePortfolioCategorySlug } from "@/lib/photoMetadata";
import { loadKnownPlaces, loadPublishedDbGuides } from "@/lib/locations/registry";
import { KNOWN_PLACES, type KnownPlace } from "@/lib/locations/places";
import type { DbGuideRef } from "@/lib/locations/guideCoverage";
import { PAGE_PHOTO_CURATION_TABLE } from "@/lib/pagePhotos/pageKeys";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { SCHOOL_SPOT_PHOTOS_TABLE } from "@/lib/schoolSpots";
import { fetchAllPages } from "@/lib/supabasePaging";
import type { CurationRow } from "@/lib/pagePhotos/curate";
import {
  enginePhotoPlace, indexEngineSources, resolvePhoto,
  type EngineSource, type PortfolioSource, type ResolvedPhoto,
} from "@/lib/pagePhotos/resolve";

export interface ExplicitSchoolPhoto {
  id: string;
  schoolSlug: string;
  url: string;
  alt: string;
  caption: string | null;
  sortOrder: number;
  width: number | null;
  height: number | null;
  quality: number | null;
  sessionKey: string;
  /** Known place the photo was taken at (Content Engine evidence only), else null. */
  placeKey: string | null;
}

/** The photographer's campus-spot tag for one photo on one school guide. */
export interface SpotTag {
  schoolSlug: string;
  imageUrl: string;
  spotKey: string;
  isFeatured: boolean;
  position: number;
}

export interface PhotoPool {
  photos: ResolvedPhoto[];
  explicitSchool: ExplicitSchoolPhoto[];
  /**
   * Grads Content Engine photos that are live in a published journal post but
   * were never added to the portfolio — matched to their session's school.
   */
  sessionSchool: ExplicitSchoolPhoto[];
  curation: CurationRow[];
  spotTags: SpotTag[];
  /** Content Engine session id → the shooting locations typed on it (primary first). */
  sessionLocations?: Record<string, string[]>;
  /** Read failures. A non-empty list means the pool is incomplete (a bug). */
  errors: string[];
}

type Rows = Record<string, unknown>[];
type One<T> = T | T[] | null;
const one = <T,>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

interface SessionEmbed {
  id: string;
  public_display_name: string | null;
  service_type: string | null;
  school_slug: string | null;
  primary_location: string | null;
  secondary_locations: string[] | null;
  marketing_permission: boolean | null;
  marketing_permission_revoked_at: string | null;
}

export function toPortfolioSource(row: Record<string, unknown>): PortfolioSource | null {
  const url = text(row.image_url);
  if (!url) return null;
  const category = normalizePortfolioCategorySlug(text(row.category_slug));
  const title = getPhotoTitle({ title: text(row.title), categorySlug: category });
  return {
    id: Number(row.id),
    url,
    title,
    alt: getPhotoAlt({ alt: text(row.alt), title, categorySlug: category }),
    category,
    featured: row.featured === true,
    sortOrder: num(row.sort_order) ?? 0,
    width: num(row.width),
    height: num(row.height),
    contentHash: text(row.content_hash),
    school: text(row.school),
    location: text(row.location),
    sessionLabel: text(row.session_label),
  };
}

function toEngineSource(row: Record<string, unknown>): EngineSource | null {
  const url = text(row.public_derivative_url);
  return url ? engineSourceFrom(row, url) : null;
}

/**
 * A session photo row (with its photography_sessions embed) as an engine
 * source at the given URL. The tagging audit also reads private photos, which
 * have no derivative yet, so the URL is passed in.
 */
export function engineSourceFrom(row: Record<string, unknown>, url: string): EngineSource | null {
  const session = one(row.photography_sessions as One<SessionEmbed>);
  if (!session) return null;
  return {
    url,
    contentHash: text(row.content_hash),
    sessionId: session.id,
    sessionName: text(session.public_display_name),
    serviceType: text(session.service_type),
    schoolSlug: text(session.school_slug),
    primaryLocation: text(session.primary_location),
    secondaryLocations: (session.secondary_locations ?? []).filter((t) => typeof t === "string"),
    photoLocation: text(row.photo_location),
    photoLocationSource: row.photo_location_source === "manual" || row.photo_location_source === "gps"
      ? row.photo_location_source : null,
    gpsLatitude: num(row.gps_latitude),
    gpsLongitude: num(row.gps_longitude),
    publishable: session.marketing_permission === true && !session.marketing_permission_revoked_at,
    excluded: row.excluded === true,
    quality: num(row.quality_score),
    width: num(row.width),
    height: num(row.height),
  };
}

function toExplicitSchool(row: Record<string, unknown>): ExplicitSchoolPhoto | null {
  const photo = one(row.session_photos as One<Record<string, unknown>>);
  const url = text(photo?.public_derivative_url);
  if (!photo || !url) return null;
  return {
    id: String(row.id),
    schoolSlug: String(row.school_slug),
    url,
    alt: text(row.alt_override) ?? text(photo.alt_text) ?? "Graduation portrait by soloxsnaps",
    caption: text(row.caption),
    sortOrder: num(row.sort_order) ?? 0,
    width: num(photo.width),
    height: num(photo.height),
    quality: num(photo.quality_score),
    sessionKey: `session:${String(photo.photography_session_id)}`,
    placeKey: null,
  };
}

export interface EngineSchoolRow {
  id: string;
  url: string;
  alt: string | null;
  source: EngineSource;
}

function toEngineSchoolRow(row: Record<string, unknown>): EngineSchoolRow | null {
  const source = toEngineSource(row);
  return source && typeof row.id === "string"
    ? { id: row.id, url: source.url, alt: text(row.alt_text), source }
    : null;
}

/**
 * Session photos whose ONLY public appearance is a journal post. Eligibility
 * is the same as everywhere else (marketing permission on, not excluded), the
 * school comes only from the session's canonical school slug — never from
 * text — and the photo must still be in a live post, so a takedown or a photo
 * removed from its post drops it here too.
 */
export function sessionSchoolPhotos(
  rows: readonly EngineSchoolRow[], liveJournalUrls: ReadonlySet<string>, portfolio: readonly PortfolioSource[],
  placeOf: (source: EngineSource) => string | null = () => null,
): ExplicitSchoolPhoto[] {
  const portfolioUrls = new Set(portfolio.map((p) => p.url));
  const portfolioHashes = new Set(portfolio.flatMap((p) => (p.contentHash ? [p.contentHash] : [])));
  return rows.filter(({ url, source }) => source.serviceType === "grads"
    && isSchoolSlug(source.schoolSlug) && source.publishable && !source.excluded
    && liveJournalUrls.has(url) && !portfolioUrls.has(url)
    && !(source.contentHash && portfolioHashes.has(source.contentHash)))
    .map(({ id, url, alt, source }) => ({
      id, schoolSlug: source.schoolSlug as string, url,
      alt: alt ?? "Graduation portrait by soloxsnaps",
      caption: null, sortOrder: 0, width: source.width, height: source.height,
      quality: source.quality, sessionKey: `session:${source.sessionId}`,
      placeKey: placeOf(source),
    }));
}

function journalUrls(posts: Rows): Set<string> {
  return new Set(posts.flatMap((post) => [
    text(post.cover_image_url),
    ...(Array.isArray(post.extra_image_urls) ? post.extra_image_urls.map(text) : []),
  ].filter((url): url is string => url !== null)));
}

function toSpotTag(row: Record<string, unknown>): SpotTag {
  return {
    schoolSlug: String(row.school_slug),
    imageUrl: String(row.image_url),
    spotKey: String(row.spot_key),
    isFeatured: row.is_featured === true,
    position: num(row.position) ?? 0,
  };
}

function toCurationRow(row: Record<string, unknown>): CurationRow {
  return {
    pageKey: String(row.page_key),
    imageUrl: String(row.image_url),
    mode: row.mode === "hide" ? "hide" : "pin",
    position: num(row.position) ?? 0,
    isHero: row.is_hero === true,
  };
}

async function settle<T>(label: string, errors: string[], fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const message = `${label}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[page-photos] ${message}`);
    errors.push(message);
    return fallback;
  }
}

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Rows> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Rows;
}

// Spot tags only add section photos. Until the school_spot_photos migration is
// applied, the guides fall back to their campus-spot photos instead of hiding
// every gallery on the site.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

async function spotTagRows(client: SupabaseClient): Promise<Rows> {
  const { data, error } = await client.from(SCHOOL_SPOT_PHOTOS_TABLE)
    .select("school_slug,image_url,spot_key,is_featured,position");
  if (error && MISSING_TABLE_CODES.has((error as { code?: string }).code ?? "")) {
    console.warn(`[page-photos] ${SCHOOL_SPOT_PHOTOS_TABLE} not migrated yet; spot sections use campus-spot photos`);
    return [];
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as Rows;
}

const PORTFOLIO_IMAGES_TABLE = "portfolio_images";
const SESSION_PHOTOS_TABLE = "session_photos";
const POOL_PORTFOLIO_COLUMNS =
  "id,title,alt,image_url,category_slug,featured,sort_order,width,height,content_hash,school,location,session_label";
const POOL_ENGINE_COLUMNS = "id,alt_text,public_derivative_url,content_hash,excluded,quality_score,width,height,"
  + "gps_latitude,gps_longitude,photo_location,photo_location_source,"
  + "photography_sessions!inner(id,public_display_name,service_type,school_slug,primary_location,secondary_locations,"
  + "marketing_permission,marketing_permission_revoked_at)";

// Both tables can outgrow PostgREST's 1000-row page, so they are read page by
// page (ordered by id) and a failed page fails the whole read.
function publishedPortfolioRows(client: SupabaseClient): Promise<Rows> {
  return fetchAllPages((from, to) => client.from(PORTFOLIO_IMAGES_TABLE).select(POOL_PORTFOLIO_COLUMNS)
    .eq("published", true).order("id").range(from, to), PORTFOLIO_IMAGES_TABLE);
}

function publicSessionPhotoRows(client: SupabaseClient): Promise<Rows> {
  return fetchAllPages((from, to) => client.from(SESSION_PHOTOS_TABLE).select(POOL_ENGINE_COLUMNS)
    .not("public_derivative_url", "is", null).order("id").range(from, to), SESSION_PHOTOS_TABLE);
}

function sessionLocationsOf(rows: readonly EngineSchoolRow[]): Record<string, string[]> {
  return Object.fromEntries(rows.map(({ source }) => [source.sessionId,
    [source.primaryLocation, ...source.secondaryLocations].filter((t): t is string => Boolean(t?.trim()))]));
}

export async function loadPhotoPool(client: SupabaseClient): Promise<PhotoPool> {
  const errors: string[] = [];
  const [portfolio, engine, school, curation, places, dbGuides, posts, spotTags] = await Promise.all([
    settle(PORTFOLIO_IMAGES_TABLE, errors, [] as Rows, () => publishedPortfolioRows(client)),
    settle(SESSION_PHOTOS_TABLE, errors, [] as Rows, () => publicSessionPhotoRows(client)),
    settle("school_page_photos", errors, [] as Rows, () => rows(client.from("school_page_photos")
      .select("id,school_slug,alt_override,caption,sort_order,session_photos!inner(public_derivative_url,alt_text,width,height,quality_score,photography_session_id)")
      .eq("active", true))),
    settle(PAGE_PHOTO_CURATION_TABLE, errors, [] as Rows, () => rows(client.from(PAGE_PHOTO_CURATION_TABLE)
      .select("page_key,image_url,mode,position,is_hero"))),
    settle("verified_locations", errors, [...KNOWN_PLACES] as KnownPlace[], () => loadKnownPlaces(client)),
    settle("location_guides", errors, [] as DbGuideRef[], () => loadPublishedDbGuides(client)),
    settle("blog_posts", errors, [] as Rows, () => rows(client.from("blog_posts")
      .select("cover_image_url,extra_image_urls").contains("sites", ["professional"]))),
    settle(SCHOOL_SPOT_PHOTOS_TABLE, errors, [] as Rows, () => spotTagRows(client)),
  ]);

  const engineRows = engine.map(toEngineSchoolRow).filter((e): e is EngineSchoolRow => e !== null);
  const findEngine = indexEngineSources(engineRows.map((e) => e.source));
  const portfolioSources = portfolio.map(toPortfolioSource).filter((p): p is PortfolioSource => p !== null);
  const photos = portfolioSources.map((p) => resolvePhoto(p, findEngine(p), { places, dbGuides }));
  const placeOf = (source: EngineSource) => enginePhotoPlace(source, places)?.key ?? null;
  const placeOfUrl = (url: string) => {
    const source = findEngine({ url, contentHash: null });
    return source ? placeOf(source) : null;
  };

  return {
    photos,
    explicitSchool: school.map(toExplicitSchool).filter((s): s is ExplicitSchoolPhoto => s !== null)
      .map((s) => ({ ...s, placeKey: placeOfUrl(s.url) })),
    sessionSchool: sessionSchoolPhotos(engineRows, journalUrls(posts), portfolioSources, placeOf),
    curation: curation.map(toCurationRow),
    spotTags: spotTags.map(toSpotTag),
    sessionLocations: sessionLocationsOf(engineRows),
    errors,
  };
}

// A failed read throws out of the cache wrapper, so an incomplete pool is never
// cached for an hour; callers log it and render the page without the gallery.
const cachedPool = cachePublicContent(async (): Promise<PhotoPool> => {
  const pool = await loadPhotoPool(createSupabaseServerClient());
  if (pool.errors.length > 0) throw new Error(`photo pool incomplete — ${pool.errors.join("; ")}`);
  return pool;
}, ["page-photo-pool-v3"]);

/** Public cached pool, or null when it could not be read (logged as a bug). */
export async function getPhotoPool(): Promise<PhotoPool | null> {
  try {
    return await cachedPool();
  } catch (err) {
    console.error("[page-photos] BUG: photo retrieval failed; galleries hidden until fixed", err);
    return null;
  }
}
