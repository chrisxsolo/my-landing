// Decides, for one public photo, which school and place it shows, whether it
// may be reused on other pages, and which pages it belongs to. Pure — the
// loader (pool.ts) gathers the rows, this module only reasons about them.
//
// School (grads photos only), strongest evidence first:
//   1. the photo's own school tag (portfolio_images.school, set in admin)
//   2. its Content Engine session's school (a stable slug, read live — fixing
//      a session's school moves its photos on the next render)
//   3. the photo's own title / alt / session text naming exactly one school
//      with high confidence. Two schools named → ambiguous → no page.
// The shooting location is NEVER used as the school.
//
// Place: the photo's location tag, then its session's location, then (older
// uploads only) its session label — matched by exact place identity, never
// by scenery. A session that names several locations places a photo only by
// that photo's own GPS (no evidence → no place). A place reaches a guide only
// when that guide page exists; a graduation photo reaches the portrait guide.
import { detectSchoolsInText } from "@/lib/schoolDetection";
import { getPhotoTitle } from "@/lib/photoMetadata";
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { guideTypeForService, isSchoolSlug, SCHOOL_SLUGS, type SchoolSlug } from "@/lib/contentEngine/taxonomy";
import { matchPlacesByName, placeAtCoordinates } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { findGuideForPlace, type DbGuideRef, type LocationGuideType } from "@/lib/locations/guideCoverage";
import { guidePageKey, schoolPageKey } from "@/lib/pagePhotos/pageKeys";

/** Text-only school matches below this confidence never place a photo ("Cal" is 0.5). */
export const TEXT_SCHOOL_MIN_CONFIDENCE = 0.9;
/**
 * A weaker alias still counts when the text uses the school's own short name
 * or registry alias as a whole word ("USF Nursing Grad"): on this site's own
 * captions those names are unambiguous. Bare "Cal" / "East Bay" are not
 * registry aliases, so they never qualify.
 */
const REGISTRY_ALIAS_MIN_CONFIDENCE = 0.7;

export interface PortfolioSource {
  id: number;
  url: string;
  title: string;
  alt: string;
  /** Display vocabulary: grads | families | couples. */
  category: string;
  featured: boolean;
  sortOrder: number;
  width: number | null;
  height: number | null;
  contentHash: string | null;
  school: string | null;
  location: string | null;
  sessionLabel: string | null;
}

export interface EngineSource {
  url: string;
  contentHash: string | null;
  sessionId: string;
  sessionName: string | null;
  serviceType: string | null;
  schoolSlug: string | null;
  primaryLocation: string | null;
  /** The session's other confirmed shooting locations. */
  secondaryLocations: readonly string[];
  /** The photo's own GPS, read from the original file. */
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  /** Marketing permission on and never revoked. */
  publishable: boolean;
  excluded: boolean;
  quality: number | null;
  width: number | null;
  height: number | null;
}

export type SchoolSource = "tag" | "session" | "text";
export type PlaceSource = "tag" | "session" | "label";

export interface ResolvedPhoto {
  url: string;
  portfolioId: number;
  title: string;
  alt: string;
  category: string;
  featured: boolean;
  sortOrder: number;
  width: number | null;
  height: number | null;
  quality: number | null;
  sessionKey: string;
  sessionLabel: string | null;
  engineSessionId: string | null;
  school: SchoolSlug | null;
  schoolSource: SchoolSource | null;
  /** Why a grads photo has no school page (shown in admin), else null. */
  schoolNote: string | null;
  /** A grads photo from a Content Engine session whose school is not set. */
  sessionSchoolMissing: boolean;
  placeKey: string | null;
  placeSource: PlaceSource | null;
  eligible: boolean;
  ineligibleReason: string | null;
  /** Page keys this photo is automatically offered to. */
  pages: string[];
}

export interface ResolveContext {
  places: readonly KnownPlace[];
  dbGuides: readonly DbGuideRef[];
}

const SLUG_BY_CANONICAL_NAME = new Map<string, SchoolSlug>(
  SCHOOL_SLUGS.map((slug) => [BUILT_IN_SCHOOLS[slug].name, slug]),
);

interface SchoolResult { school: SchoolSlug | null; source: SchoolSource | null; note: string | null }

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function usesRegistryName(slug: SchoolSlug | undefined, text: string): boolean {
  if (!slug) return false;
  const { shortName, aliases } = BUILT_IN_SCHOOLS[slug];
  return [shortName, ...aliases]
    .filter((name) => name.length >= 3)
    .some((name) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(name.toLowerCase())}($|[^a-z0-9])`).test(text.toLowerCase()));
}

/** Schools named in free text, as built-in slugs (null = a school with no page). */
export function inferSchoolFromText(text: string): SchoolResult {
  const strong = detectSchoolsInText(text).filter((s) => s.confidence >= TEXT_SCHOOL_MIN_CONFIDENCE
    || (s.confidence >= REGISTRY_ALIAS_MIN_CONFIDENCE && usesRegistryName(SLUG_BY_CANONICAL_NAME.get(s.canonicalName), text)));
  if (strong.length === 0) return { school: null, source: null, note: "no school named in the photo's title or alt text" };
  if (strong.length > 1) {
    return { school: null, source: null, note: `ambiguous: names ${strong.map((s) => s.abbreviation).join(" and ")}` };
  }
  const slug = SLUG_BY_CANONICAL_NAME.get(strong[0].canonicalName) ?? null;
  return slug
    ? { school: slug, source: "text", note: null }
    : { school: null, source: null, note: `${strong[0].abbreviation} has no school page` };
}

function resolveSchool(photo: PortfolioSource, engine: EngineSource | null): SchoolResult {
  if (photo.category !== "grads") return { school: null, source: null, note: null };
  if (isSchoolSlug(photo.school)) return { school: photo.school, source: "tag", note: null };
  if (engine?.schoolSlug) {
    return isSchoolSlug(engine.schoolSlug)
      ? { school: engine.schoolSlug, source: "session", note: null }
      : { school: null, source: null, note: `session school "${engine.schoolSlug}" has no school page` };
  }
  const text = [photo.title, photo.alt, photo.sessionLabel, engine?.sessionName].filter(Boolean).join(" · ");
  const inferred = inferSchoolFromText(text);
  if (inferred.school || !engine) return inferred;
  return { ...inferred, note: `Content Engine session has no school; ${inferred.note}` };
}

function singlePlace(text: string | null | undefined, places: readonly KnownPlace[]): KnownPlace | null {
  if (!text?.trim()) return null;
  const matches = matchPlacesByName(text, places);
  return matches.length === 1 ? matches[0] : null;
}

function labelPlace(label: string | null, places: readonly KnownPlace[]): KnownPlace | null {
  if (!label) return null;
  const whole = singlePlace(label, places);
  if (whole) return whole;
  const parts = label.split("·").map((part) => singlePlace(part, places)).filter((p): p is KnownPlace => p !== null);
  const keys = new Set(parts.map((p) => p.key));
  return keys.size === 1 ? parts[0] : null;
}

/**
 * Where one Content Engine photo was taken. A session at one location gives
 * it to every photo. A session at several ("SF State" + "Palace of Fine Arts")
 * places a photo only when its own GPS falls inside one of the named places,
 * so campus frames never land on the Palace and photos without GPS stay
 * unplaced (the school page still shows them).
 */
export function enginePhotoPlace(engine: EngineSource, places: readonly KnownPlace[]): KnownPlace | null {
  const named = [engine.primaryLocation, ...engine.secondaryLocations].filter((t): t is string => Boolean(t?.trim()));
  const resolved = named.map((text) => singlePlace(text, places));
  const known = resolved.filter((p): p is KnownPlace => p !== null);
  const keys = new Set(known.map((p) => p.key));
  if (known.length === named.length && keys.size === 1) return known[0];
  if (named.length < 2 || engine.gpsLatitude === null || engine.gpsLongitude === null) return null;
  const candidates = known.filter((p, i) => known.findIndex((o) => o.key === p.key) === i);
  const hit = placeAtCoordinates({ latitude: engine.gpsLatitude, longitude: engine.gpsLongitude }, candidates);
  return hit?.place ?? null;
}

function resolvePlace(
  photo: PortfolioSource, engine: EngineSource | null, places: readonly KnownPlace[],
): { place: KnownPlace | null; source: PlaceSource | null } {
  const tagged = singlePlace(photo.location, places);
  if (tagged) return { place: tagged, source: "tag" };
  if (engine) {
    const session = enginePhotoPlace(engine, places);
    return session ? { place: session, source: "session" } : { place: null, source: null };
  }
  const labelled = labelPlace(photo.sessionLabel, places);
  return labelled ? { place: labelled, source: "label" } : { place: null, source: null };
}

/**
 * Which location-guide family a photo can appear in. Graduation portraits go
 * to the portrait guide of the place they were shot at (an SF State session
 * at the Palace of Fine Arts → /portrait-guide/locations/palace-of-fine-arts),
 * never to couples or family guides.
 */
function guideTypeOf(photo: PortfolioSource, engine: EngineSource | null): LocationGuideType | null {
  if (engine) {
    const type = guideTypeForService(engine.serviceType);
    if (type === "grad") return "portrait";
    return type === "couples" || type === "family" || type === "portrait" ? type : null;
  }
  if (photo.category === "couples") return "couples";
  if (photo.category === "families") return "family";
  if (photo.category === "grads") return "portrait";
  return null;
}

function eligibility(engine: EngineSource | null): { eligible: boolean; reason: string | null } {
  if (!engine) return { eligible: true, reason: null };
  if (!engine.publishable) return { eligible: false, reason: "session is not cleared for marketing" };
  if (engine.excluded) return { eligible: false, reason: "excluded in the Content Engine" };
  return { eligible: true, reason: null };
}

// Groups frames from one shoot so the page can spread them out. Older uploads
// have no session; photos sharing an identical, specific title were captioned
// as a set. The category placeholder ("Graduation portrait") says nothing about
// the shoot, so untitled photos each stand alone.
function sessionKeyOf(photo: PortfolioSource, engine: EngineSource | null): string {
  if (engine) return `session:${engine.sessionId}`;
  if (photo.sessionLabel) return `label:${photo.sessionLabel}`;
  const placeholder = getPhotoTitle({ title: null, categorySlug: photo.category });
  return photo.title.trim() === placeholder ? `photo:${photo.id}` : `title:${photo.title.trim().toLowerCase()}`;
}

export function resolvePhoto(
  photo: PortfolioSource, engine: EngineSource | null, ctx: ResolveContext,
): ResolvedPhoto {
  const school = resolveSchool(photo, engine);
  const { place, source: placeSource } = resolvePlace(photo, engine, ctx.places);
  const { eligible, reason } = eligibility(engine);
  const guide = guideTypeOf(photo, engine);
  const guidePage = place && guide ? findGuideForPlace(guide, place.key, ctx.dbGuides) : null;
  const pages = eligible
    ? [
        ...(school.school ? [schoolPageKey(school.school)] : []),
        ...(guidePage ? [guidePageKey(guidePage.guide, guidePage.slug)] : []),
      ]
    : [];
  return {
    url: photo.url,
    portfolioId: photo.id,
    title: photo.title,
    alt: photo.alt,
    category: photo.category,
    featured: photo.featured,
    sortOrder: photo.sortOrder,
    width: photo.width ?? engine?.width ?? null,
    height: photo.height ?? engine?.height ?? null,
    quality: engine?.quality ?? null,
    sessionKey: sessionKeyOf(photo, engine),
    sessionLabel: photo.sessionLabel,
    engineSessionId: engine?.sessionId ?? null,
    school: school.school,
    schoolSource: school.source,
    schoolNote: school.note,
    sessionSchoolMissing: photo.category === "grads" && engine !== null && !engine.schoolSlug,
    placeKey: place?.key ?? null,
    placeSource,
    eligible,
    ineligibleReason: reason,
    pages,
  };
}

/** Engine rows indexed by derivative URL and by original content hash. */
export function indexEngineSources(rows: readonly EngineSource[]) {
  const byUrl = new Map(rows.map((row) => [row.url, row]));
  const byHash = new Map(rows.filter((r) => r.contentHash).map((row) => [row.contentHash as string, row]));
  return (photo: Pick<PortfolioSource, "url" | "contentHash">): EngineSource | null =>
    byUrl.get(photo.url) ?? (photo.contentHash ? byHash.get(photo.contentHash) ?? null : null);
}
