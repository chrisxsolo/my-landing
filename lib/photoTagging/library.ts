// Loads the photo library and audits it. Server-only, uncached (the admin
// reads it right after writing). Photos are read page by page (ordered by id)
// so the audit never silently stops at PostgREST's 1000-row cap; a failed
// page is an audit error, and writes refuse to run on an incomplete audit.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILT_IN_SCHOOL_OPTIONS, CUSTOM_SCHOOLS_TABLE, schoolLabel } from "@/lib/contentEngine/schools";
import { SCHOOL_SLUGS } from "@/lib/contentEngine/taxonomy";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";
import { KNOWN_PLACES, type KnownPlace } from "@/lib/locations/places";
import type { DbGuideRef } from "@/lib/locations/guideCoverage";
import { loadKnownPlaces, loadPublishedDbGuides } from "@/lib/locations/registry";
import { SCHOOL_SPOT_PHOTOS_TABLE, spotsForSchool } from "@/lib/schoolSpots";
import { fetchAllPages } from "@/lib/supabasePaging";
import { assembleLibrary, type LibraryEntry, type SpotTagRow } from "@/lib/photoTagging/assemble";
import { countTags } from "@/lib/photoTagging/filters";
import { loadReviews, type PhotoReview } from "@/lib/photoTagging/reviews";
import {
  canonicalCategory, categoryLabel, PORTFOLIO_IMAGES_TABLE, SESSION_PHOTOS_TABLE,
  type CategoryChoice, type TaggingOptions, type TaggingReport,
} from "@/lib/photoTagging/types";

type Rows = Record<string, unknown>[];

export const PORTFOLIO_COLUMNS =
  "id,title,alt,image_url,category_slug,featured,sort_order,width,height,content_hash,school,location,session_label,published";
const ENGINE_COLUMNS = "id,storage_path,public_derivative_url,content_hash,excluded,title,alt_text,description,tags,"
  + "quality_score,width,height,gps_latitude,gps_longitude,photo_location,photo_location_source,"
  + "photography_sessions!inner(id,public_display_name,service_type,school_slug,primary_location,secondary_locations,marketing_permission,marketing_permission_revoked_at)";

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Rows> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Rows;
}

async function settle<T>(label: string, errors: string[], fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const message = `${label}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[photo-tagging] ${message}`);
    errors.push(message);
    return fallback;
  }
}

export interface LoadedAudit {
  entries: LibraryEntry[];
  places: readonly KnownPlace[];
  customSchools: Map<string, string>;
  categories: CategoryChoice[];
  errors: string[];
}

/** Every library photo with its audit. Optionally narrowed to one Content Engine session. */
export async function loadAudit(client: SupabaseClient, sessionId?: string): Promise<LoadedAudit> {
  const errors: string[] = [];
  const [portfolio, engine, spotTags, reviews, places, dbGuides, custom, categories] = await Promise.all([
    settle(PORTFOLIO_IMAGES_TABLE, errors, [] as Rows, () => fetchAllPages((from, to) => client.from(PORTFOLIO_IMAGES_TABLE)
      .select(PORTFOLIO_COLUMNS).order("id").range(from, to), PORTFOLIO_IMAGES_TABLE)),
    settle(SESSION_PHOTOS_TABLE, errors, [] as Rows, () => fetchAllPages((from, to) => client.from(SESSION_PHOTOS_TABLE)
      .select(ENGINE_COLUMNS).order("id").range(from, to), SESSION_PHOTOS_TABLE)),
    settle(SCHOOL_SPOT_PHOTOS_TABLE, errors, [] as Rows, () => rows(client.from(SCHOOL_SPOT_PHOTOS_TABLE)
      .select("school_slug,image_url,spot_key"))),
    settle("photo_tag_reviews", errors, new Map<string, PhotoReview>(), () => loadReviews(client)),
    settle("verified_locations", errors, [...KNOWN_PLACES] as KnownPlace[], () => loadKnownPlaces(client)),
    settle("location_guides", errors, [] as DbGuideRef[], () => loadPublishedDbGuides(client)),
    settle(CUSTOM_SCHOOLS_TABLE, errors, [] as Rows, () => rows(client.from(CUSTOM_SCHOOLS_TABLE).select("slug,name,short_name"))),
    settle("portfolio_categories", errors, [] as Rows, () => rows(client.from("portfolio_categories").select("slug,sort_order").order("sort_order"))),
  ]);
  const customSchools = new Map(custom.map((r) => [String(r.slug), schoolLabel({
    name: String(r.name), shortName: typeof r.short_name === "string" ? r.short_name : null,
  })]));
  const entries = assembleLibrary({
    portfolio, engine, reviews, places, dbGuides, customSchools,
    spotTags: spotTags.map((r): SpotTagRow => ({
      schoolSlug: String(r.school_slug), imageUrl: String(r.image_url), spotKey: String(r.spot_key),
    })),
  });
  return {
    entries: sessionId ? entries.filter((e) => e.photo.sessionId === sessionId) : entries,
    places, customSchools, errors,
    categories: categories.flatMap((r) => {
      const slug = canonicalCategory(String(r.slug));
      return slug ? [{ slug, label: categoryLabel(slug) }] : [];
    }),
  };
}

export function taggingOptions(audit: LoadedAudit): TaggingOptions {
  return {
    schools: [
      ...BUILT_IN_SCHOOL_OPTIONS.map((s) => ({ slug: s.slug, label: schoolLabel(s), builtIn: true })),
      ...[...audit.customSchools].map(([slug, label]) => ({ slug, label, builtIn: false })),
    ],
    spots: Object.fromEntries(SCHOOL_SLUGS.flatMap((slug) => {
      const spots = spotsForSchool(slug);
      return spots.length > 0 ? [[slug, spots.map((s) => ({ key: s.key, name: s.name }))]] : [];
    })),
    categories: audit.categories,
    places: [...new Set(audit.places.map((p) => p.name))].sort(),
  };
}

export function toReport(audit: LoadedAudit): TaggingReport {
  const photos = audit.entries.map((e) => e.photo);
  return { photos, counts: countTags(photos), options: taggingOptions(audit), errors: audit.errors };
}

const THUMB_TTL_SECONDS = 60 * 60;
const THUMB_WIDTH = 360;
const SIGN_CONCURRENCY = 8;

/**
 * Small signed thumbnails for private Content Engine photos (public photos
 * use their own URL). Fetched once per page load, never on refresh, so the
 * grid does not reload every image after each edit.
 */
export async function signPrivateThumbs(client: SupabaseClient, entries: readonly LibraryEntry[]): Promise<Record<string, string>> {
  const pending = entries.filter((e) => !e.photo.url && e.vision.storagePath);
  const out: Record<string, string> = {};
  for (let i = 0; i < pending.length; i += SIGN_CONCURRENCY) {
    await Promise.all(pending.slice(i, i + SIGN_CONCURRENCY).map(async (entry) => {
      const { data, error } = await client.storage.from(ORIGINALS_BUCKET).createSignedUrl(
        entry.vision.storagePath as string, THUMB_TTL_SECONDS,
        { transform: { width: THUMB_WIDTH, height: THUMB_WIDTH, resize: "cover" } },
      );
      if (error || !data?.signedUrl) console.error("[photo-tagging] thumbnail signing failed", entry.photo.key, error);
      else out[entry.photo.key] = data.signedUrl;
    }));
  }
  return out;
}
