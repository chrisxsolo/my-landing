// Server-only: gathers the facts lib/photoSync/distribution.ts lines up for
// one photo (where it CAN appear) and lib/photoSync/placements.ts (where it
// DOES appear). Read-only; every input comes from the loader that already
// feeds that destination (tagging audit, page curation, campus-spot picks,
// the placement tables).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationSpot } from "@/lib/gradGuideData";
import { curate, loadAll, type Loaded } from "@/lib/pagePhotos/adminView";
import { readAutoRows } from "@/lib/campusSpotFill/store";
import { schoolSlugForSpot } from "@/lib/campusSpotFill/pageSpots";
import { loadAudit } from "@/lib/photoTagging/library";
import { spotsForSchool } from "@/lib/schoolSpots";
import { isSchoolSlug, SPOT_SCHOOL_IDS, type SchoolSlug } from "@/lib/contentEngine/taxonomy";
import type { AuditedPhoto } from "@/lib/photoTagging/types";
import { parsePageKey } from "@/lib/pagePhotos/pageKeys";
import { publicThumbUrl } from "@/lib/guidePhotoLibrary/load";
import { EDITABLE_SETTING_KEYS } from "@/lib/siteSettingsShared";
import {
  classifyDistribution, type CampusSpotPick, type Destination, type PagePlacement,
} from "@/lib/photoSync/distribution";
import { loadPostImageInventory } from "@/lib/blog/publishedImages";
import { buildPlacements, type Placement, type PlacementFacts } from "@/lib/photoSync/placements";
import { loadEngineFacts, loadPlacementFacts } from "@/lib/photoSync/placementLoad";
import type { AddTarget } from "@/lib/photoSync/placementActions";

const LOCATION_SPOTS_TABLE = "location_spots";
const SESSION_PHOTOS_TABLE = "session_photos";
const IMAGE_SETTING_KEY = /^(home_|pricing_).*(?<!_post)$/;

export interface AddOption { label: string; target: AddTarget }

export interface DistributionPhoto extends Pick<AuditedPhoto, "key" | "title" | "url" | "category" | "school" | "published"> {
  thumbUrl: string | null;
  enginePhotoId: string | null;
  /** "from journal post X" for photos no other source knows. */
  origin: string | null;
}

export interface PhotoDistribution {
  photo: DistributionPhoto;
  destinations: Destination[];
  placements: Placement[];
  addOptions: AddOption[];
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

/** A legacy journal image (no Portfolio row, no Content Engine photo) as an audited photo. */
function journalAsAudited(loaded: Loaded, url: string): { photo: AuditedPhoto; origin: string } | null {
  const j = loaded.pool.journal.find((p) => p.url === url);
  if (!j) return null;
  const photo: AuditedPhoto = {
    key: j.id, source: "portfolio", portfolioId: null, enginePhotoId: null, sessionId: null, sessionName: j.postTitle,
    url: j.url, published: true, title: j.alt, category: j.serviceType, school: j.school, status: j.school ? "full" : "partial",
    checks: [], suggestions: [], pages: j.pages, spotTaggable: true, aiAnalyzedAt: null,
  };
  return { photo, origin: `from journal post "${j.postTitle}"` };
}

async function campusSpotOptions(client: SupabaseClient, school: SchoolSlug | null): Promise<AddOption[]> {
  const schoolId = school ? SPOT_SCHOOL_IDS[school] : null;
  if (!schoolId) return [];
  const { data, error } = await client.from(LOCATION_SPOTS_TABLE).select("id,name,image_url").eq("school_id", schoolId).order("order");
  if (error) throw new Error(`location_spots: ${error.message}`);
  return ((data ?? []) as Pick<LocationSpot, "id" | "name" | "image_url">[]).map((spot) => ({
    label: `Campus spot · ${spot.name.trim()}${spot.image_url ? " (replaces its photo)" : ""}`,
    target: { kind: "campus-spot", spotId: spot.id },
  }));
}

function addOptionsFor(destinations: readonly Destination[], enginePhotoId: string | null): AddOption[] {
  const pages = destinations.filter((d) => d.id.startsWith("page:") && d.status === "eligible").flatMap((d) => {
    const key = d.id.slice("page:".length);
    const parsed = parsePageKey(key);
    const pin: AddOption = { label: `Pin on ${d.label}`, target: { kind: "page", pageKey: key } };
    const attach: AddOption[] = parsed && parsed.kind !== "grads" && enginePhotoId
      ? [{ label: `Add to ${d.label} gallery`, target: { kind: "guide", guide: parsed.kind, slug: parsed.slug, sessionPhotoId: enginePhotoId } }]
      : [];
    return [pin, ...attach];
  });
  const slots = EDITABLE_SETTING_KEYS.filter((key) => IMAGE_SETTING_KEY.test(key))
    .map((key): AddOption => ({ label: `Site slot · ${key}`, target: { kind: "site-slot", key } }));
  return [...pages, ...slots];
}

/**
 * The posts' own image inventory (the same one the journal editors show) for
 * the handful of posts that carry this photo: exact roles, and the Content
 * Engine session that published the post, so the editor link opens its
 * workspace. One photo at a time — the batched facts stay as they are.
 */
async function withJournalInventory(client: SupabaseClient, facts: PlacementFacts): Promise<PlacementFacts> {
  const posts = [...new Map(facts.journal.map((j) => [j.postId, j])).values()];
  if (posts.length === 0) return facts;
  const inventories = await Promise.all(posts.map((j) => loadPostImageInventory(client, j.postId)));
  const journal = inventories.flatMap((inv, i) => {
    const roles = [...new Set(inv.photos.filter((p) => p.url === facts.url && !p.fallback).map((p) => p.role))];
    return roles.map((role) => ({ ...posts[i], title: inv.title, slug: inv.slug, role, engineSessionId: inv.engine?.sessionId ?? null }));
  });
  return { ...facts, journal };
}

export interface DistributionLookup { key?: string | null; url?: string | null }

export async function loadPhotoDistribution(client: SupabaseClient, lookup: DistributionLookup): Promise<PhotoDistribution | null> {
  const [audit, loaded] = await Promise.all([loadAudit(client), loadAll(client)]);
  const entry = audit.entries.find((e) => (lookup.key ? e.photo.key === lookup.key : e.photo.url === lookup.url));
  const journal = !entry && lookup.url ? journalAsAudited(loaded, lookup.url) : null;
  const photo = entry?.photo ?? journal?.photo;
  if (!photo) return null;
  const url = photo.url;
  const [permission, campusSpot, facts, spotOptions] = await Promise.all([
    permissionFor(client, loaded, photo),
    url ? campusSpotFor(client, loaded, url) : Promise.resolve(null),
    url ? loadPlacementFacts(client, loaded, [url]) : Promise.resolve(new Map()),
    campusSpotOptions(client, photo.category === "grads" && isSchoolSlug(photo.school) ? photo.school : null),
  ]);
  const enginePhotoId = photo.enginePhotoId ?? (url ? (await loadEngineFacts(client, [url])).get(url)?.photoId ?? null : null);
  const destinations = classifyDistribution({
    photo, permission, campusSpot,
    placements: url ? placementsFor(loaded, url, photo.pages) : {},
    pageLabels: Object.fromEntries(loaded.pages.map((p) => [p.key, p.label])),
    schoolHasSpots: Boolean(photo.school && isSchoolSlug(photo.school) && spotsForSchool(photo.school).length > 0),
  });
  const batched = url ? facts.get(url) : undefined;
  const placementFacts = batched ? await withJournalInventory(client, batched) : undefined;
  return {
    photo: {
      key: photo.key, title: photo.title, url, category: photo.category, school: photo.school, published: photo.published,
      thumbUrl: url ? publicThumbUrl(url) : null, enginePhotoId, origin: journal?.origin ?? null,
    },
    destinations,
    placements: placementFacts ? buildPlacements(placementFacts) : [],
    addOptions: photo.published && url ? [...addOptionsFor(destinations, enginePhotoId), ...spotOptions] : [],
    errors: [...new Set([...audit.errors, ...loaded.pool.errors])],
  };
}
