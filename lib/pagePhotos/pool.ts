// Loads every photo that is already public, plus the facts needed to place
// it: its Content Engine session (school, location, permission, exclusion),
// explicit school-page placements, known places, live guide pages, and the
// admin's per-page curation. Server-only.
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
import type { CurationRow } from "@/lib/pagePhotos/curate";
import {
  indexEngineSources, resolvePhoto,
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
}

export interface PhotoPool {
  photos: ResolvedPhoto[];
  explicitSchool: ExplicitSchoolPhoto[];
  curation: CurationRow[];
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
  marketing_permission: boolean | null;
  marketing_permission_revoked_at: string | null;
}

function toPortfolioSource(row: Record<string, unknown>): PortfolioSource | null {
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
  const session = one(row.photography_sessions as One<SessionEmbed>);
  if (!url || !session) return null;
  return {
    url,
    contentHash: text(row.content_hash),
    sessionId: session.id,
    sessionName: text(session.public_display_name),
    serviceType: text(session.service_type),
    schoolSlug: text(session.school_slug),
    primaryLocation: text(session.primary_location),
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

export async function loadPhotoPool(client: SupabaseClient): Promise<PhotoPool> {
  const errors: string[] = [];
  const [portfolio, engine, school, curation, places, dbGuides] = await Promise.all([
    settle("portfolio_images", errors, [] as Rows, () => rows(client.from("portfolio_images")
      .select("id,title,alt,image_url,category_slug,featured,sort_order,width,height,content_hash,school,location,session_label")
      .eq("published", true))),
    settle("session_photos", errors, [] as Rows, () => rows(client.from("session_photos")
      .select("public_derivative_url,content_hash,excluded,quality_score,width,height,photography_sessions!inner(id,public_display_name,service_type,school_slug,primary_location,marketing_permission,marketing_permission_revoked_at)")
      .not("public_derivative_url", "is", null))),
    settle("school_page_photos", errors, [] as Rows, () => rows(client.from("school_page_photos")
      .select("id,school_slug,alt_override,caption,sort_order,session_photos!inner(public_derivative_url,alt_text,width,height,quality_score,photography_session_id)")
      .eq("active", true))),
    settle(PAGE_PHOTO_CURATION_TABLE, errors, [] as Rows, () => rows(client.from(PAGE_PHOTO_CURATION_TABLE)
      .select("page_key,image_url,mode,position,is_hero"))),
    settle("verified_locations", errors, [...KNOWN_PLACES] as KnownPlace[], () => loadKnownPlaces(client)),
    settle("location_guides", errors, [] as DbGuideRef[], () => loadPublishedDbGuides(client)),
  ]);

  const findEngine = indexEngineSources(engine.map(toEngineSource).filter((e): e is EngineSource => e !== null));
  const photos = portfolio
    .map(toPortfolioSource)
    .filter((p): p is PortfolioSource => p !== null)
    .map((p) => resolvePhoto(p, findEngine(p), { places, dbGuides }));

  return {
    photos,
    explicitSchool: school.map(toExplicitSchool).filter((s): s is ExplicitSchoolPhoto => s !== null),
    curation: curation.map(toCurationRow),
    errors,
  };
}

// A failed read throws out of the cache wrapper, so an incomplete pool is never
// cached for an hour; callers log it and render the page without the gallery.
const cachedPool = cachePublicContent(async (): Promise<PhotoPool> => {
  const pool = await loadPhotoPool(createSupabaseServerClient());
  if (pool.errors.length > 0) throw new Error(`photo pool incomplete — ${pool.errors.join("; ")}`);
  return pool;
}, ["page-photo-pool-v1"]);

/** Public cached pool, or null when it could not be read (logged as a bug). */
export async function getPhotoPool(): Promise<PhotoPool | null> {
  try {
    return await cachedPool();
  } catch (err) {
    console.error("[page-photos] BUG: photo retrieval failed; galleries hidden until fixed", err);
    return null;
  }
}
