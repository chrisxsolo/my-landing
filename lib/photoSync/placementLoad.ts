// Server-only: gathers the rows lib/photoSync/placements.ts lines up — every
// table and setting that can reference a photo URL — for one or many URLs in
// one batch of queries (never one query per photo). Read-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAutoRows } from "@/lib/campusSpotFill/store";
import { schoolSlugForSpot, spotKeyOf } from "@/lib/campusSpotFill/pageSpots";
import { LOCATION_GUIDE_TYPES, type LocationGuideType } from "@/lib/locations/guideCoverage";
import { GUIDE_PHOTO_TABLE } from "@/lib/guidePhotoLibrary/load";
import { FEATURED_SESSION_SETTING_KEYS } from "@/lib/homepageData";
import { curate, type Loaded } from "@/lib/pagePhotos/adminView";
import { guidePageKey, parsePageKey } from "@/lib/pagePhotos/pageKeys";
import { isLivePost } from "@/lib/pagePhotos/journalSource";
import { spotsForSchool } from "@/lib/schoolSpots";
import { EDITABLE_SETTING_KEYS, type EditableSettingKey } from "@/lib/siteSettingsShared";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import type { PlacementFacts } from "@/lib/photoSync/placements";

type Row = Record<string, unknown>;
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

const PORTFOLIO_IMAGES_TABLE = "portfolio_images";
const SESSION_PHOTOS_TABLE = "session_photos";
const LOCATION_SPOTS_TABLE = "location_spots";
const BLOG_POSTS_TABLE = "blog_posts";
const SITE_SETTINGS_TABLE = "site_settings";
const BAY_AREA_LOCATIONS_TABLE = "bay_area_locations";
const CASE_STUDIES_TABLE = "portfolio_case_studies";
const BLOG_POST_COLUMNS = "id,slug,title,published_at,cover_image_url,extra_image_urls";
const CASE_STUDY_COLUMNS = "id,title,active,cover_image_url,preview_image_urls";

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, label: string): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Content Engine facts per derivative URL: the photo id and why it is blocked, if it is. */
export interface EngineFact { photoId: string; blockedReason: string | null }

export async function loadEngineFacts(client: SupabaseClient, urls: readonly string[]): Promise<Map<string, EngineFact>> {
  if (urls.length === 0) return new Map();
  const data = await rows(client.from(SESSION_PHOTOS_TABLE)
    .select("id,public_derivative_url,excluded,photography_sessions!inner(marketing_permission,marketing_permission_revoked_at)")
    .in("public_derivative_url", [...urls]), SESSION_PHOTOS_TABLE);
  return new Map(data.flatMap((row) => {
    const url = text(row.public_derivative_url);
    const id = text(row.id);
    if (!url || !id) return [];
    const embed = row.photography_sessions as Row | Row[] | null;
    const session = Array.isArray(embed) ? embed[0] : embed;
    const blockedReason = row.excluded === true ? "excluded in the Content Engine"
      : !session?.marketing_permission || session.marketing_permission_revoked_at ? "session is not cleared for marketing" : null;
    return [[url, { photoId: id, blockedReason }] as const];
  }));
}

interface Batch {
  portfolio: Row[]; spots: Row[]; guides: { guide: LocationGuideType; rows: Row[] }[]; posts: Row[];
  settings: Row[]; locations: Row[]; caseStudies: Row[]; auto: Awaited<ReturnType<typeof readAutoRows>>;
}

async function loadBatch(client: SupabaseClient, urls: readonly string[], engineIds: readonly string[]): Promise<Batch> {
  const list = [...urls];
  const inList = (table: string, columns: string, column: string) => rows(client.from(table).select(columns).in(column, list), table);
  const overlaps = (table: string, columns: string, column: string) => rows(client.from(table).select(columns).overlaps(column, list), table);
  const [portfolio, spots, guides, cover, extra, settings, locations, csCover, csPreview, auto] = await Promise.all([
    inList(PORTFOLIO_IMAGES_TABLE, "id,image_url,published,category_slug,hero_carousel", "image_url"),
    inList(LOCATION_SPOTS_TABLE, "id,school_id,name,spot_key,image_url", "image_url"),
    Promise.all(LOCATION_GUIDE_TYPES.map(async (guide) => ({
      guide, rows: await inList(GUIDE_PHOTO_TABLE[guide], "id,location_slug,image_url,published,featured", "image_url"),
    }))),
    inList(BLOG_POSTS_TABLE, BLOG_POST_COLUMNS, "cover_image_url"),
    overlaps(BLOG_POSTS_TABLE, BLOG_POST_COLUMNS, "extra_image_urls"),
    rows(client.from(SITE_SETTINGS_TABLE).select("key,value").in("key", [...EDITABLE_SETTING_KEYS]), SITE_SETTINGS_TABLE),
    engineIds.length > 0
      ? rows(client.from(BAY_AREA_LOCATIONS_TABLE).select("id,title,active,featured_photo_id").in("featured_photo_id", [...engineIds]), BAY_AREA_LOCATIONS_TABLE)
      : Promise.resolve([] as Row[]),
    inList(CASE_STUDIES_TABLE, CASE_STUDY_COLUMNS, "cover_image_url"),
    overlaps(CASE_STUDIES_TABLE, CASE_STUDY_COLUMNS, "preview_image_urls"),
    readAutoRows(client),
  ]);
  const byId = (a: Row[], b: Row[]) => [...new Map([...a, ...b].map((r) => [String(r.id), r])).values()];
  return { portfolio, spots, guides, posts: byId(cover, extra), settings, locations, caseStudies: byId(csCover, csPreview), auto };
}

function pagesFor(loaded: Loaded, url: string): PlacementFacts["pages"] {
  return loaded.pages.flatMap((page) => {
    const { curated } = curate(loaded, page.key);
    const shown = curated.ordered.some((c) => c.url === url);
    const parsed = parsePageKey(page.key);
    const explicit = parsed?.kind === "grads"
      ? loaded.pool.explicitSchool.find((s) => s.url === url && s.schoolSlug === parsed.slug) ?? null : null;
    if (!shown && !explicit) return [];
    const pinned = loaded.pool.curation.some((r) => r.pageKey === page.key && r.imageUrl === url && r.mode === "pin");
    return [{ key: page.key, label: page.label, shown, pinned, explicitId: explicit?.id ?? null }];
  });
}

const spotName = (school: string, key: string) =>
  (isSchoolSlug(school) ? spotsForSchool(school).find((s) => s.key === key)?.name : null) ?? key;

function campusSpotsFor(loaded: Loaded, batch: Batch, url: string): PlacementFacts["campusSpots"] {
  const manual = batch.spots.filter((r) => r.image_url === url).map((r) => {
    const spot = { school_id: String(r.school_id), name: String(r.name), spot_key: text(r.spot_key) ?? undefined };
    return { spotId: num(r.id), schoolSlug: schoolSlugForSpot(spot) ?? spot.school_id, spotKey: spotKeyOf(spot) ?? spot.name,
      spotName: spot.name.trim(), origin: "manual" as const };
  });
  const tags = loaded.pool.spotTags.filter((t) => t.imageUrl === url).map((t) => ({
    spotId: null, schoolSlug: t.schoolSlug, spotKey: t.spotKey, spotName: spotName(t.schoolSlug, t.spotKey), origin: "tag" as const,
  }));
  const auto = batch.auto.filter((r) => r.imageUrl === url).map((r) => ({
    spotId: null, schoolSlug: r.schoolSlug, spotKey: r.spotKey, spotName: spotName(r.schoolSlug, r.spotKey), origin: "auto" as const,
  }));
  return [...manual, ...tags, ...auto];
}

function guidesFor(loaded: Loaded, batch: Batch, url: string): PlacementFacts["guides"] {
  return batch.guides.flatMap(({ guide, rows: list }) => list.filter((r) => r.image_url === url).map((r) => {
    const slug = String(r.location_slug);
    const name = loaded.pages.find((p) => p.key === guidePageKey(guide, slug))?.label.split(" · ").at(-1) ?? slug;
    return { guide, rowId: String(r.id), slug, name, published: r.published === true, featured: r.featured === true };
  }));
}

function journalFor(batch: Batch, url: string): PlacementFacts["journal"] {
  return batch.posts.flatMap((post) => {
    const base = { postId: Number(post.id), slug: String(post.slug), title: text(post.title) ?? String(post.slug),
      published: isLivePost({ publishedAt: text(post.published_at) }) };
    return [
      ...(post.cover_image_url === url ? [{ ...base, role: "cover" as const }] : []),
      ...(strings(post.extra_image_urls).includes(url) ? [{ ...base, role: "gallery" as const }] : []),
    ];
  });
}

function slotsFor(batch: Batch, url: string): Pick<PlacementFacts, "siteSlots" | "featuredSessions"> {
  const siteSlots = batch.settings.filter((s) => s.value === url).map((s) => s.key as EditableSettingKey);
  const featured = Object.values(FEATURED_SESSION_SETTING_KEYS).flatMap((key) => {
    const slug = text(batch.settings.find((s) => s.key === key)?.value);
    const post = slug ? batch.posts.find((p) => p.slug === slug && p.cover_image_url === url) : null;
    return post ? [{ key: key as EditableSettingKey, postSlug: slug as string }] : [];
  });
  return { siteSlots, featuredSessions: featured };
}

function caseStudiesFor(batch: Batch, url: string): PlacementFacts["caseStudies"] {
  return batch.caseStudies.flatMap((c) => {
    const base = { id: Number(c.id), title: text(c.title) ?? `Case study #${c.id}`, active: c.active === true };
    return [
      ...(c.cover_image_url === url ? [{ ...base, field: "cover" as const }] : []),
      ...(strings(c.preview_image_urls).includes(url) ? [{ ...base, field: "preview" as const }] : []),
    ];
  });
}

/** Why a URL may not be shown publicly: the pool's verdict for Portfolio photos, else the Content Engine's. */
function blockedReasonFor(loaded: Loaded, engine: ReadonlyMap<string, EngineFact>, url: string): string | null {
  const pooled = loaded.pool.photos.find((p) => p.url === url);
  if (pooled && !pooled.eligible) return pooled.ineligibleReason ?? "not eligible";
  return engine.get(url)?.blockedReason ?? null;
}

/** Placement facts for every URL, from one batch of queries. */
export async function loadPlacementFacts(
  client: SupabaseClient, loaded: Loaded, urls: readonly string[],
): Promise<Map<string, PlacementFacts>> {
  const unique = [...new Set(urls)];
  if (unique.length === 0) return new Map();
  const engine = await loadEngineFacts(client, unique);
  const batch = await loadBatch(client, unique, [...engine.values()].map((e) => e.photoId));
  return new Map(unique.map((url) => {
    const photoId = engine.get(url)?.photoId ?? null;
    return [url, {
      url,
      blockedReason: blockedReasonFor(loaded, engine, url),
      portfolio: batch.portfolio.filter((r) => r.image_url === url).map((r) => ({
        id: Number(r.id), published: r.published !== false, category: text(r.category_slug) ?? "portfolio", heroCarousel: r.hero_carousel === true,
      })),
      pages: pagesFor(loaded, url),
      campusSpots: campusSpotsFor(loaded, batch, url),
      guides: guidesFor(loaded, batch, url),
      journal: journalFor(batch, url),
      ...slotsFor(batch, url),
      locations: photoId
        ? batch.locations.filter((l) => l.featured_photo_id === photoId).map((l) => ({ id: Number(l.id), title: text(l.title) ?? `#${l.id}`, active: l.active === true }))
        : [],
      caseStudies: caseStudiesFor(batch, url),
    }];
  }));
}
