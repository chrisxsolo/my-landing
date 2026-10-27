// Server-only: gathers the facts lib/photoSync/distribution.ts lines up for
// one photo. Read-only; every input comes from the loader that already feeds
// that destination (tagging audit, page curation, campus-spot picks).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationSpot } from "@/lib/gradGuideData";
import { curate, loadAll, type Loaded } from "@/lib/pagePhotos/adminView";
import { readAutoRows } from "@/lib/campusSpotFill/store";
import { schoolSlugForSpot } from "@/lib/campusSpotFill/pageSpots";
import { loadAudit } from "@/lib/photoTagging/library";
import { spotsForSchool } from "@/lib/schoolSpots";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import type { AuditedPhoto } from "@/lib/photoTagging/types";
import {
  classifyDistribution, type CampusSpotPick, type Destination, type PagePlacement,
} from "@/lib/photoSync/distribution";

const LOCATION_SPOTS_TABLE = "location_spots";
const SESSION_PHOTOS_TABLE = "session_photos";

export interface PhotoDistribution {
  photo: Pick<AuditedPhoto, "key" | "title" | "url" | "category" | "school" | "published">;
  destinations: Destination[];
  /** Read failures: a non-empty list means some statuses may be incomplete. */
  errors: string[];
}

function placementsFor(loaded: Loaded, url: string, eligible: readonly string[]): Record<string, PagePlacement> {
  const known = new Set(loaded.pages.map((p) => p.key));
  const curatedOn = loaded.pool.curation.filter((r) => r.imageUrl === url).map((r) => r.pageKey);
  const keys = [...new Set([...eligible, ...curatedOn])].filter((k) => known.has(k));
  return Object.fromEntries(keys.map((key) => {
    const { curated } = curate(loaded, key);
    const has = (list: { url: string }[]) => list.some((c) => c.url === url);
    const placement: PagePlacement = has(curated.ordered) ? "shown"
      : has(curated.overflow) ? "overflow" : has(curated.hidden) ? "hidden" : "not-listed";
    return [key, placement];
  }));
}

const spotName = (school: string, key: string) =>
  (isSchoolSlug(school) ? spotsForSchool(school).find((s) => s.key === key)?.name : null) ?? key;

async function campusSpotFor(client: SupabaseClient, loaded: Loaded, url: string): Promise<CampusSpotPick | null> {
  const { data, error } = await client.from(LOCATION_SPOTS_TABLE).select("school_id,name,image_url").eq("image_url", url).limit(1);
  if (error) throw new Error(`location_spots: ${error.message}`);
  const manual = (data ?? [])[0] as Pick<LocationSpot, "school_id" | "name"> | undefined;
  if (manual) return { schoolSlug: schoolSlugForSpot(manual) ?? "", spotKey: manual.name, spotName: manual.name.trim(), origin: "manual" };
  const tag = loaded.pool.spotTags.find((t) => t.imageUrl === url);
  if (tag) return { schoolSlug: tag.schoolSlug, spotKey: tag.spotKey, spotName: spotName(tag.schoolSlug, tag.spotKey), origin: "tag" };
  const auto = (await readAutoRows(client)).find((r) => r.imageUrl === url);
  return auto ? { schoolSlug: auto.schoolSlug, spotKey: auto.spotKey, spotName: spotName(auto.schoolSlug, auto.spotKey), origin: "auto" } : null;
}

/** Marketing permission and exclusion, from the pool for a Portfolio photo, else from the session. */
async function permissionFor(client: SupabaseClient, loaded: Loaded, photo: AuditedPhoto): Promise<{ ok: boolean; reason: string | null }> {
  const pooled = photo.url ? loaded.pool.photos.find((p) => p.url === photo.url) : null;
  if (pooled) return { ok: pooled.eligible, reason: pooled.ineligibleReason };
  if (!photo.enginePhotoId) return { ok: true, reason: null };
  const { data, error } = await client.from(SESSION_PHOTOS_TABLE)
    .select("excluded,photography_sessions!inner(marketing_permission,marketing_permission_revoked_at)")
    .eq("id", photo.enginePhotoId).maybeSingle();
  if (error) throw new Error(`session_photos: ${error.message}`);
  const row = data as { excluded?: boolean; photography_sessions?: { marketing_permission?: boolean; marketing_permission_revoked_at?: string | null } } | null;
  if (row?.excluded) return { ok: false, reason: "excluded in the Content Engine" };
  const session = row?.photography_sessions;
  if (!session?.marketing_permission || session.marketing_permission_revoked_at) return { ok: false, reason: "session is not cleared for marketing" };
  return { ok: true, reason: null };
}

export async function loadPhotoDistribution(client: SupabaseClient, photoKey: string): Promise<PhotoDistribution | null> {
  const [audit, loaded] = await Promise.all([loadAudit(client), loadAll(client)]);
  const entry = audit.entries.find((e) => e.photo.key === photoKey);
  if (!entry) return null;
  const { photo } = entry;
  const url = photo.url;
  const [permission, campusSpot] = await Promise.all([
    permissionFor(client, loaded, photo),
    url ? campusSpotFor(client, loaded, url) : Promise.resolve(null),
  ]);
  const destinations = classifyDistribution({
    photo, permission, campusSpot,
    placements: url ? placementsFor(loaded, url, photo.pages) : {},
    pageLabels: Object.fromEntries(loaded.pages.map((p) => [p.key, p.label])),
    schoolHasSpots: Boolean(photo.school && isSchoolSlug(photo.school) && spotsForSchool(photo.school).length > 0),
  });
  return {
    photo: { key: photo.key, title: photo.title, url, category: photo.category, school: photo.school, published: photo.published },
    destinations,
    errors: [...new Set([...audit.errors, ...loaded.pool.errors])],
  };
}
