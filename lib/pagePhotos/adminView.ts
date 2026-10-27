// Admin + audit views over the photo pool. Server-only, always uncached so the
// admin sees its own writes immediately. Uses the same candidate builder and
// curation as the public pages, so the preview is exactly what visitors get.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { SCHOOL_SLUGS } from "@/lib/contentEngine/taxonomy";
import { getAllCouplesLocations } from "@/lib/couplesGuide/locations";
import { getAllFamilyLocations } from "@/lib/familyGuide/locations";
import { getAllPortraitLocations } from "@/lib/portraitGuide/locations";
import { COUPLES_LOCATION_PHOTOS_TABLE } from "@/lib/couplesGuide/photos";
import { FAMILY_LOCATION_PHOTOS_TABLE } from "@/lib/familyGuide/photos";
import { PORTRAIT_LOCATION_PHOTOS_TABLE } from "@/lib/portraitGuide/photos";
import { GUIDE_LABEL, LOCATION_GUIDE_TYPES, type LocationGuideType } from "@/lib/locations/guideCoverage";
import { loadPublishedDbGuides } from "@/lib/locations/registry";
import { curatePage, type CuratedPage, type CurationRow, type PageCandidate } from "@/lib/pagePhotos/curate";
import {
  candidatesForPage, curationFor, GUIDE_PAGE_LIMIT, SCHOOL_PAGE_LIMIT, type GuidePhotoRow,
} from "@/lib/pagePhotos/candidates";
import { guidePageKey, pagePath, parsePageKey, schoolPageKey } from "@/lib/pagePhotos/pageKeys";
import { loadPhotoPool, type PhotoPool } from "@/lib/pagePhotos/pool";
import { spotKeysByPlace, spotsForSchool, suggestSpotFromText } from "@/lib/schoolSpots";

const GUIDE_TABLE: Record<LocationGuideType, string> = {
  couples: COUPLES_LOCATION_PHOTOS_TABLE,
  family: FAMILY_LOCATION_PHOTOS_TABLE,
  portrait: PORTRAIT_LOCATION_PHOTOS_TABLE,
};

const STATIC_GUIDES: Record<LocationGuideType, () => { slug: string; name: string }[]> = {
  couples: getAllCouplesLocations,
  family: getAllFamilyLocations,
  portrait: getAllPortraitLocations,
};

export interface PageRef { key: string; path: string; label: string }

export interface PageSummary extends PageRef {
  ownCount: number;
  matchedCount: number;
  shownCount: number;
  hiddenCount: number;
}

export interface PageViewPhoto {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  /** "own" = placed on this page on purpose; "matched" = automatic. */
  origin: "own" | "matched";
  why: string;
  mode: "pin" | "hide" | null;
  isHero: boolean;
  /** Photographer-set campus spot on this school's guide, if any. */
  spotKey: string | null;
  spotFeatured: boolean;
  /** Spot the photo's own text suggests — a hint to confirm, never applied. */
  spotHint: string | null;
  /** "place" = shot at an off-campus spot's place (shown there automatically); "text" = named in the photo's text. */
  spotHintSource: "place" | "text" | null;
}

export interface SpotOption { key: string; name: string }

export interface PageView extends PageRef {
  /** Campus spots this school's location guide has sections for. */
  spots: SpotOption[];
  shown: PageViewPhoto[];
  overflow: PageViewPhoto[];
  hidden: PageViewPhoto[];
}

export interface UnmatchedPhoto { portfolioId: number; url: string; title: string; note: string }

export interface PagePhotoReport {
  errors: string[];
  pages: PageSummary[];
  schoolSources: Record<string, number>;
  unmatchedGrads: UnmatchedPhoto[];
  heldBack: { portfolioId: number; url: string; title: string; reason: string }[];
  sessionsNeedingFacts: { sessionId: string; name: string | null; issue: string }[];
}

export interface Loaded { pool: PhotoPool; pages: PageRef[]; guideRows: Map<string, GuidePhotoRow[]> }

async function loadGuideRows(client: SupabaseClient, errors: string[]): Promise<Map<string, GuidePhotoRow[]>> {
  const result = new Map<string, GuidePhotoRow[]>();
  await Promise.all(LOCATION_GUIDE_TYPES.map(async (guide) => {
    const { data, error } = await client.from(GUIDE_TABLE[guide])
      .select("id,location_slug,image_url,alt_text,caption,featured,sort_order")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) { errors.push(`${GUIDE_TABLE[guide]}: ${error.message}`); return; }
    for (const row of (data ?? []) as (GuidePhotoRow & { location_slug: string })[]) {
      const key = guidePageKey(guide, row.location_slug);
      result.set(key, [...(result.get(key) ?? []), row]);
    }
  }));
  return result;
}

async function listPages(client: SupabaseClient, errors: string[]): Promise<PageRef[]> {
  const schools = SCHOOL_SLUGS.map((slug) => schoolPageKey(slug))
    .map((key, i) => ({ key, path: pagePath(key) as string, label: `Grads · ${BUILT_IN_SCHOOLS[SCHOOL_SLUGS[i]].shortName}` }));
  const db = await loadPublishedDbGuides(client).catch((err: Error) => { errors.push(`location_guides: ${err.message}`); return []; });
  const guides = LOCATION_GUIDE_TYPES.flatMap((guide) => [
    ...STATIC_GUIDES[guide]().map((loc) => ({ guide, slug: loc.slug, name: loc.name })),
    ...db.filter((g) => g.guide === guide).map((g) => ({ guide, slug: g.slug, name: g.name })),
  ]).map(({ guide, slug, name }) => {
    const key = guidePageKey(guide, slug);
    return { key, path: pagePath(key) as string, label: `${GUIDE_LABEL[guide]} · ${name}` };
  });
  return [...schools, ...guides];
}

export async function loadAll(client: SupabaseClient): Promise<Loaded> {
  const pool = await loadPhotoPool(client);
  const [pages, guideRows] = await Promise.all([listPages(client, pool.errors), loadGuideRows(client, pool.errors)]);
  return { pool, pages, guideRows };
}

export function curate(loaded: Loaded, key: string): { candidates: PageCandidate[]; curated: CuratedPage } {
  const own = loaded.guideRows.get(key) ?? [];
  const isSchool = parsePageKey(key)?.kind === "grads";
  const candidates = candidatesForPage(loaded.pool, key, own);
  const curated = curatePage(candidates, curationFor(loaded.pool, key), {
    limit: isSchool ? SCHOOL_PAGE_LIMIT : Math.max(GUIDE_PAGE_LIMIT, own.length),
    preferPortraitHero: isSchool,
    mixPlacements: isSchool,
  });
  return { candidates, curated };
}

function explain(loaded: Loaded, c: PageCandidate): string {
  if (c.explicit) return c.id.startsWith("school:") ? "Content Engine school placement" : "uploaded to this guide";
  if (c.id.startsWith("session:")) return "school from Content Engine session · live in a journal post";
  const photo = loaded.pool.photos.find((p) => p.url === c.url);
  if (!photo) return "matched";
  const school = photo.schoolSource ? `school from ${photo.schoolSource === "tag" ? "photo tag" : photo.schoolSource === "session" ? "Content Engine session" : "photo text"}` : null;
  const place = photo.placeSource ? `place from ${photo.placeSource === "tag" ? "photo location" : photo.placeSource === "session" ? "session location" : "session label"}` : null;
  return [school, place].filter(Boolean).join(" · ") || "matched";
}

function spotFacts(loaded: Loaded, key: string, c: PageCandidate) {
  const parsed = parsePageKey(key);
  if (parsed?.kind !== "grads" || spotsForSchool(parsed.slug).length === 0) {
    return { spotKey: null, spotFeatured: false, spotHint: null, spotHintSource: null };
  }
  const tag = loaded.pool.spotTags.find((t) => t.schoolSlug === parsed.slug && t.imageUrl === c.url);
  const photo = loaded.pool.photos.find((p) => p.url === c.url);
  // Location evidence first (an off-campus spot fills from it automatically),
  // then the photo's own text, which is only ever a suggestion.
  const placed = c.placeKey ? spotKeysByPlace(parsed.slug)[c.placeKey] : undefined;
  const hint = tag ? null : placed
    ? { key: placed }
    : suggestSpotFromText(parsed.slug, [photo?.title, c.alt].filter(Boolean).join(" · "));
  return {
    spotKey: tag?.spotKey ?? null, spotFeatured: tag?.isFeatured ?? false,
    spotHint: hint?.key ?? null,
    spotHintSource: hint ? (placed ? "place" as const : "text" as const) : null,
  };
}

function toViewPhoto(loaded: Loaded, key: string, rules: CurationRow[], c: PageCandidate): PageViewPhoto {
  const rule = rules.find((r) => r.imageUrl === c.url);
  return {
    url: c.url, alt: c.alt, width: c.width, height: c.height,
    origin: c.explicit ? "own" : "matched", why: explain(loaded, c),
    mode: rule?.mode ?? null, isHero: rule?.isHero ?? false,
    ...spotFacts(loaded, key, c),
  };
}

export async function buildPageView(client: SupabaseClient, key: string): Promise<PageView | null> {
  const loaded = await loadAll(client);
  const ref = loaded.pages.find((p) => p.key === key);
  if (!ref) return null;
  const { curated } = curate(loaded, key);
  const rules = curationFor(loaded.pool, key);
  const view = (list: PageCandidate[]) => list.map((c) => toViewPhoto(loaded, key, rules, c));
  const parsed = parsePageKey(key);
  const spots = parsed?.kind === "grads" ? spotsForSchool(parsed.slug).map(({ key: k, name }) => ({ key: k, name })) : [];
  return { ...ref, spots, shown: view(curated.ordered), overflow: view(curated.overflow), hidden: view(curated.hidden) };
}

function sessionsNeedingFacts(pool: PhotoPool): PagePhotoReport["sessionsNeedingFacts"] {
  const seen = new Map<string, { sessionId: string; name: string | null; issue: string }>();
  for (const p of pool.photos) {
    if (!p.engineSessionId || !p.sessionSchoolMissing || seen.has(p.engineSessionId)) continue;
    const issue = p.school
      ? `grads session has no school set (photos matched ${p.school} from their text only)`
      : "grads session has no school set";
    seen.set(p.engineSessionId, { sessionId: p.engineSessionId, name: p.sessionLabel, issue });
  }
  return [...seen.values()];
}

export async function buildPagePhotoReport(client: SupabaseClient): Promise<PagePhotoReport> {
  const loaded = await loadAll(client);
  const { pool } = loaded;
  const pages = loaded.pages.map((ref) => {
    const { candidates, curated } = curate(loaded, ref.key);
    return {
      ...ref,
      ownCount: candidates.filter((c) => c.explicit).length,
      matchedCount: candidates.filter((c) => !c.explicit).length,
      shownCount: curated.ordered.length,
      hiddenCount: curated.hidden.length,
    };
  });
  const grads = pool.photos.filter((p) => p.category === "grads");
  const schoolSources = grads.reduce<Record<string, number>>((acc, p) => {
    const key = p.schoolSource ?? "none";
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});
  return {
    errors: pool.errors,
    pages,
    schoolSources,
    unmatchedGrads: grads.filter((p) => !p.school).map((p) => ({
      portfolioId: p.portfolioId, url: p.url, title: p.title, note: p.schoolNote ?? "no school",
    })),
    heldBack: pool.photos.filter((p) => !p.eligible).map((p) => ({
      portfolioId: p.portfolioId, url: p.url, title: p.title, reason: p.ineligibleReason ?? "not eligible",
    })),
    sessionsNeedingFacts: sessionsNeedingFacts(pool),
  };
}
