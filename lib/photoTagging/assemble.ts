// Turns loaded rows into audited photos. Pure — library.ts loads, this reasons.
//
// One library entry per physical photo:
//   · every portfolio_images row (its Content Engine session, if any, is
//     linked exactly the way the public pool links it: derivative URL, then
//     content hash, public derivatives only)
//   · every INCLUDED Content Engine photo that is not already a portfolio row
//     (same derivative URL or same original hash = the same photo, never
//     counted twice). Excluded photos were set aside by the photographer.
// School and place come from lib/pagePhotos/resolve.ts — the same decision
// the public pages make — so "tagged" always means "the site can place it".
// A photo's location is ITS OWN fact: the portfolio tag, or the Content
// Engine photo's confirmed photo_location (manual or GPS). The session's
// locations are only context for suggestions (lib/photoTagging/suggest.ts).
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { placeAtCoordinates } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import type { DbGuideRef } from "@/lib/locations/guideCoverage";
import { schoolPageKey } from "@/lib/pagePhotos/pageKeys";
import { engineSourceFrom, toPortfolioSource } from "@/lib/pagePhotos/pool";
import {
  enginePhotoPlace, indexEngineSources, resolvePhoto,
  type EngineSource, type PortfolioSource, type ResolvedPhoto,
} from "@/lib/pagePhotos/resolve";
import { spotKeysByPlace, spotsForSchool } from "@/lib/schoolSpots";
import type { PlanTarget } from "@/lib/photoTagging/plan";
import type { PhotoReview } from "@/lib/photoTagging/reviews";
import { statusOf, tagChecks, type FactValue, type PhotoFacts } from "@/lib/photoTagging/rules";
import { suggestTags } from "@/lib/photoTagging/suggest";
import {
  canonicalCategory, enginePhotoKey, isLocationEvidence, portfolioPhotoKey, type AuditedPhoto, type LocationEvidence,
} from "@/lib/photoTagging/types";

type Row = Record<string, unknown>;

export interface SpotTagRow { schoolSlug: string; imageUrl: string; spotKey: string }

export interface LoadedLibrary {
  portfolio: Row[];
  /** session_photos rows with their photography_sessions embed (all, including excluded). */
  engine: Row[];
  spotTags: SpotTagRow[];
  reviews: ReadonlyMap<string, PhotoReview>;
  places: readonly KnownPlace[];
  dbGuides: readonly DbGuideRef[];
  /** Custom school slug → display name. */
  customSchools: ReadonlyMap<string, string>;
}

/** What AI vision needs to look at a photo. */
export interface VisionInput { imageUrl: string | null; storagePath: string | null }

export interface LibraryEntry { photo: AuditedPhoto; target: PlanTarget; vision: VisionInput }

interface EngineRow {
  id: string;
  storagePath: string | null;
  url: string | null;
  contentHash: string | null;
  excluded: boolean;
  analysisText: string;
  gps: { latitude: number; longitude: number } | null;
  /** session_photos.photo_location_evidence, when recorded. */
  locationEvidence: LocationEvidence | null;
  source: EngineSource;
}

interface Member { group: string | null; school: string | null; location: string | null; key: string }

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const SCHOOL_SOURCE: Record<string, string> = { tag: "photo tag", session: "session", text: "caption" };

function toEngineRow(row: Row): EngineRow | null {
  const url = text(row.public_derivative_url);
  const source = engineSourceFrom(row, url ?? "");
  if (!source || typeof row.id !== "string") return null;
  const lat = num(row.gps_latitude);
  const lng = num(row.gps_longitude);
  const tags = Array.isArray(row.tags) ? row.tags.filter((t) => typeof t === "string").join(", ") : "";
  return {
    id: row.id, storagePath: text(row.storage_path), url, contentHash: text(row.content_hash),
    excluded: row.excluded === true,
    analysisText: [text(row.title), text(row.alt_text), text(row.description), tags].filter(Boolean).join(" · "),
    gps: lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null,
    locationEvidence: isLocationEvidence(row.photo_location_evidence) ? row.photo_location_evidence : null,
    source,
  };
}

function schoolLabel(slug: string, custom: ReadonlyMap<string, string>): string {
  return isSchoolSlug(slug) ? BUILT_IN_SCHOOLS[slug].shortName : custom.get(slug) ?? slug;
}

/** The photo's school: the page-resolved one, else a custom (page-less) school from its own tag or its session. */
function schoolFact(resolved: ResolvedPhoto, tag: string | null, engine: EngineSource | null, lib: LoadedLibrary): PhotoFacts["school"] {
  if (resolved.school) {
    return { value: resolved.school, label: schoolLabel(resolved.school, lib.customSchools),
      source: SCHOOL_SOURCE[resolved.schoolSource ?? "tag"], builtIn: true };
  }
  const custom = tag && !isSchoolSlug(tag) ? { slug: tag, source: "photo tag" }
    : engine?.schoolSlug && !isSchoolSlug(engine.schoolSlug) ? { slug: engine.schoolSlug, source: "session" } : null;
  return custom ? { value: custom.slug, label: schoolLabel(custom.slug, lib.customSchools), source: custom.source, builtIn: false } : null;
}

function spotFact(school: string | null, url: string | null, placeKey: string | null, lib: LoadedLibrary): FactValue | null {
  if (!school || !isSchoolSlug(school)) return null;
  const name = (key: string) => spotsForSchool(school).find((s) => s.key === key)?.name ?? key;
  const tag = url ? lib.spotTags.find((t) => t.schoolSlug === school && t.imageUrl === url) : undefined;
  if (tag) return { value: tag.spotKey, label: name(tag.spotKey), source: "photo tag" };
  const placed = placeKey ? spotKeysByPlace(school)[placeKey] : undefined;
  return placed ? { value: placed, label: name(placed), source: "location" } : null;
}

/** The spot tag itself (a spot inferred from the photo's place is not stored anywhere). */
const storedSpot = (spot: FactValue | null): string | null => (spot?.source === "photo tag" ? spot.value : null);

function placeName(key: string | null, places: readonly KnownPlace[]): string | null {
  return key ? places.find((p) => p.key === key)?.name ?? key : null;
}

/** The Content Engine photo's own confirmed location (never its session's). */
function ownLocation(engine: EngineRow | null): FactValue | null {
  const value = engine?.source.photoLocation;
  if (!value) return null;
  const stored = engine.source.photoLocationSource ?? null;
  return { value, source: stored === "gps" ? "GPS" : "photo tag", evidence: engine.locationEvidence ?? stored };
}

/** Photo's own location tag, else its Content Engine photo's location, else the place its (legacy) session label names. */
function portfolioLocation(
  source: PortfolioSource, engine: EngineRow | null, resolved: ResolvedPhoto, places: readonly KnownPlace[],
): FactValue | null {
  if (source.location) return { value: source.location, source: "photo tag", evidence: "manual" };
  const own = ownLocation(engine);
  if (own) return own;
  const labelled = resolved.placeSource === "label" ? placeName(resolved.placeKey, places) : null;
  return labelled ? { value: labelled, source: "session label" } : null;
}

function siblingsOf(member: Member, members: readonly Member[]) {
  const others = member.group ? members.filter((m) => m.group === member.group && m.key !== member.key) : [];
  return {
    schools: others.flatMap((m) => (m.school ? [m.school] : [])),
    locations: others.flatMap((m) => (m.location ? [m.location] : [])),
  };
}

interface Draft {
  key: string;
  facts: PhotoFacts;
  member: Member;
  engine: EngineRow | null;
  captionText: string;
  schoolScope: "photo" | "session";
  photo: Omit<AuditedPhoto, "status" | "checks" | "suggestions" | "school" | "aiAnalyzedAt">;
  target: PlanTarget;
  vision: VisionInput;
}

function review(lib: LoadedLibrary, key: string) {
  const r = lib.reviews.get(key);
  return { notApplicable: r?.notApplicable ?? [], dismissed: r?.dismissed ?? [], ai: r?.ai ?? [], at: r?.aiAnalyzedAt ?? null };
}

function portfolioDraft(row: Row, source: PortfolioSource, engine: EngineRow | null, lib: LoadedLibrary): Draft {
  const key = portfolioPhotoKey(source.id);
  const resolved = resolvePhoto(source, engine?.url ? engine.source : null, lib);
  const category = canonicalCategory(text(row.category_slug));
  const school = schoolFact(resolved, source.school, engine?.url ? engine.source : null, lib);
  const published = row.published !== false;
  const location = portfolioLocation(source, engine, resolved, lib.places);
  const spot = spotFact(school?.value ?? null, source.url, resolved.placeKey, lib);
  const facts: PhotoFacts = {
    category, school, schoolNote: resolved.schoolNote, location, spot,
    schoolSpotCount: school?.builtIn ? spotsForSchool(school.value).length : 0,
    spotTaggable: published, notApplicable: review(lib, key).notApplicable,
  };
  return {
    key, facts, engine, captionText: `${source.title} · ${source.alt}`, schoolScope: "photo",
    member: { key, group: resolved.engineSessionId ?? (source.sessionLabel ? `label:${source.sessionLabel}` : null),
      school: source.school, location: source.location },
    photo: {
      key, source: "portfolio", portfolioId: source.id, enginePhotoId: engine?.id ?? null,
      sessionId: resolved.engineSessionId, sessionName: engine?.source.sessionName ?? source.sessionLabel,
      url: source.url, published, title: source.title, category,
      pages: published ? resolved.pages : [], spotTaggable: published,
    },
    target: { key, source: "portfolio", portfolioId: source.id, enginePhotoId: null, sessionId: resolved.engineSessionId,
      url: published ? source.url : null, category, school: school?.value ?? null,
      location: location?.value ?? null, spot: spot?.value ?? null,
      stored: { school: source.school, location: source.location, spot: storedSpot(spot) },
      storedLocationSource: source.location ? "manual" : null },
    vision: { imageUrl: source.url, storagePath: null },
  };
}

function engineDraft(engine: EngineRow, lib: LoadedLibrary): Draft {
  const key = enginePhotoKey(engine.id);
  const s = engine.source;
  const category = canonicalCategory(s.serviceType);
  const school = category === "grads" && s.schoolSlug
    ? { value: s.schoolSlug, label: schoolLabel(s.schoolSlug, lib.customSchools), source: "session", builtIn: isSchoolSlug(s.schoolSlug) }
    : null;
  const location = ownLocation(engine);
  const place = enginePhotoPlace(s, lib.places);
  const spot = spotFact(school?.value ?? null, engine.url, place?.key ?? null, lib);
  const facts: PhotoFacts = {
    category, school, schoolNote: category === "grads" && !school ? "the session has no school set" : null,
    location, spot, schoolSpotCount: school?.builtIn ? spotsForSchool(school.value).length : 0,
    spotTaggable: engine.url !== null, notApplicable: review(lib, key).notApplicable,
  };
  const pages = engine.url && school?.builtIn && s.publishable ? [schoolPageKey(school.value)] : [];
  return {
    key, facts, engine, captionText: "", schoolScope: "session",
    member: { key, group: s.sessionId, school: null, location: location?.value ?? null },
    photo: {
      key, source: "engine", portfolioId: null, enginePhotoId: engine.id, sessionId: s.sessionId,
      sessionName: s.sessionName, url: engine.url, published: engine.url !== null,
      title: s.sessionName ? `${s.sessionName} session photo` : "Session photo",
      category, pages, spotTaggable: engine.url !== null,
    },
    target: { key, source: "engine", portfolioId: null, enginePhotoId: engine.id, sessionId: s.sessionId, url: engine.url,
      category, school: school?.value ?? null, location: location?.value ?? null, spot: spot?.value ?? null,
      stored: { school: s.schoolSlug, location: s.photoLocation ?? null, spot: storedSpot(spot) },
      storedLocationSource: s.photoLocation ? s.photoLocationSource ?? null : null },
    vision: { imageUrl: engine.url, storagePath: engine.storagePath },
  };
}

function finish(draft: Draft, members: readonly Member[], lib: LoadedLibrary): LibraryEntry {
  const r = review(lib, draft.key);
  const gps = draft.engine?.gps ? placeAtCoordinates(draft.engine.gps, lib.places)?.place ?? null : null;
  const s = draft.engine?.source;
  const suggestions = suggestTags({
    facts: draft.facts, schoolScope: draft.schoolScope,
    sessionLocations: s ? [s.primaryLocation, ...s.secondaryLocations].filter((t): t is string => Boolean(t?.trim())) : [],
    gpsPlace: gps, captionText: draft.captionText, analysisText: draft.engine?.analysisText ?? "",
    siblings: siblingsOf(draft.member, members), vision: r.ai, dismissed: r.dismissed, places: lib.places,
  });
  const checks = tagChecks(draft.facts, suggestions);
  return {
    photo: { ...draft.photo, school: draft.facts.school?.value ?? null, status: statusOf(checks), checks, suggestions, aiAnalyzedAt: r.at },
    target: draft.target,
    vision: draft.vision,
  };
}

export function assembleLibrary(lib: LoadedLibrary): LibraryEntry[] {
  const engineRows = lib.engine.map(toEngineRow).filter((e): e is EngineRow => e !== null);
  const publicEngine = engineRows.filter((e) => e.url);
  const findSource = indexEngineSources(publicEngine.map((e) => e.source));
  const byUrl = new Map(publicEngine.map((e) => [e.url as string, e]));
  const portfolio = lib.portfolio.flatMap((row) => {
    const source = toPortfolioSource(row);
    if (!source) return [];
    const linked = findSource(source);
    return [{ row, source, engine: linked ? byUrl.get(linked.url) ?? null : null }];
  });
  const usedUrls = new Set(portfolio.map((p) => p.source.url));
  const usedHashes = new Set(portfolio.flatMap((p) => (p.source.contentHash ? [p.source.contentHash] : [])));
  const drafts = [
    ...portfolio.map((p) => portfolioDraft(p.row, p.source, p.engine, lib)),
    ...engineRows
      .filter((e) => !e.excluded && !(e.url && usedUrls.has(e.url)) && !(e.contentHash && usedHashes.has(e.contentHash)))
      .map((e) => engineDraft(e, lib)),
  ];
  const members = drafts.map((d) => d.member);
  return drafts.map((d) => finish(d, members, lib));
}
