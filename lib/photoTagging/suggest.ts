// Tag suggestions for a photo's MISSING fields, from records that already
// exist — no new AI call. Pure.
//
// Confidence follows the request's rules:
//   high   — reliable records: the photo's GPS inside a verified place's
//            radius, a session with exactly ONE location, the photographer's
//            location tag naming one campus spot, or two+ photos from the
//            same session already tagged the same way. Offered for one-click
//            "apply all".
//   medium — text written by AI (portfolio alt text, Content Engine analysis)
//            or AI vision (looks alone never confirm a place). Shown for
//            approval, never applied in bulk.
//   low    — not shown; the field stays flagged for manual review.
// A session's location is context for its photos, never a photo's fact: a
// shoot at the Palace, the Legion and Crissy Field offers all three. When
// records disagree (several session places, GPS vs session, siblings vs
// session) every one of them is offered as a COMPETING medium suggestion for
// the photographer to pick — none is applied automatically. GPS inside one
// of the session's places settles it.
// Identity only: a place is suggested only when text names exactly one known
// place (lib/locations/match), never because a photo looks like somewhere —
// the Shark Fin Cove → Ocean Beach mistake cannot happen here.
import { BUILT_IN_SCHOOLS } from "@/lib/contentEngine/schools";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { matchPlacesByName } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { inferSchoolFromText } from "@/lib/pagePhotos/resolve";
import { spotCandidatesFromText, spotsForSchool, suggestSpotFromText } from "@/lib/schoolSpots";
import type { PhotoFacts } from "@/lib/photoTagging/rules";
import type { Confidence, SuggestionOrigin, TagField, TagSuggestion } from "@/lib/photoTagging/types";

export interface SuggestionContext {
  facts: PhotoFacts;
  /** Engine-only photos take their school from the session (a session-wide write). */
  schoolScope: "photo" | "session";
  /** Locations typed on the photo's Content Engine session (primary first). */
  sessionLocations: readonly string[];
  /** Known place the photo's own GPS falls inside, if any. */
  gpsPlace: KnownPlace | null;
  /** The photo's own title + alt text. */
  captionText: string;
  /** Content Engine analysis text (title, alt, description, tags). */
  analysisText: string;
  /** Explicit tags on other photos from the same session. */
  siblings: { schools: readonly string[]; locations: readonly string[] };
  /** Stored AI vision suggestions (already capped at medium). */
  vision: readonly TagSuggestion[];
  dismissed: readonly string[];
  places: readonly KnownPlace[];
}

const RANK: Record<Confidence, number> = { high: 0, medium: 1 };
/** Origins that are records about the photo or its shoot (not AI-written text). */
const RECORD_ORIGINS = new Set<SuggestionOrigin>(["gps", "session", "siblings", "location"]);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function make(
  field: TagField, value: string, label: string, confidence: Confidence,
  origin: SuggestionOrigin, reason: string, appliesTo: "photo" | "session",
): TagSuggestion {
  return { id: `${field}:${value}`, field, value, label, confidence, origin, reason, appliesTo };
}

const schoolName = (slug: string) => (isSchoolSlug(slug) ? BUILT_IN_SCHOOLS[slug].shortName : slug);

/** The single value every tagged sibling agrees on, with how many agree. */
function agreed(values: readonly string[]): { value: string; count: number } | null {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  const distinct = new Set(cleaned.map((v) => v.toLowerCase()));
  return distinct.size === 1 ? { value: cleaned[0], count: cleaned.length } : null;
}

function onePlace(text: string, places: readonly KnownPlace[]): KnownPlace | null {
  if (!text.trim()) return null;
  const hits = matchPlacesByName(text, places);
  return hits.length === 1 ? hits[0] : null;
}

function schoolSuggestions(ctx: SuggestionContext): TagSuggestion[] {
  const out: TagSuggestion[] = [];
  const sibling = agreed(ctx.siblings.schools);
  if (sibling && isSchoolSlug(sibling.value)) {
    out.push(make("school", sibling.value, schoolName(sibling.value), sibling.count >= 2 ? "high" : "medium",
      "siblings", `${sibling.count} other photo(s) from this session are tagged ${schoolName(sibling.value)}`, "photo"));
  }
  const fromSession = inferSchoolFromText(ctx.sessionLocations.join(" · ")).school;
  if (fromSession) {
    out.push(make("school", fromSession, schoolName(fromSession), "high", "session",
      `the session's location names ${schoolName(fromSession)}`, ctx.schoolScope));
  }
  const fromAnalysis = inferSchoolFromText(ctx.analysisText).school;
  if (fromAnalysis) {
    out.push(make("school", fromAnalysis, schoolName(fromAnalysis), "medium", "analysis",
      `Content Engine analysis mentions ${schoolName(fromAnalysis)}`, ctx.schoolScope));
  }
  return out;
}

/** The session's typed locations as the site names them, without repeats. */
function sessionPlaces(ctx: SuggestionContext): string[] {
  const names = ctx.sessionLocations.map((t) => onePlace(t, ctx.places)?.name ?? t.trim()).filter(Boolean);
  return names.filter((n, i) => names.findIndex((o) => same(o, n)) === i);
}

function recordLocations(ctx: SuggestionContext): TagSuggestion[] {
  const out: TagSuggestion[] = [];
  const session = sessionPlaces(ctx);
  const gps = ctx.gpsPlace;
  if (gps) {
    out.push(make("location", gps.name, gps.name, "high", "gps", `the photo's GPS is inside ${gps.name}`, "photo"));
    // GPS inside one of the session's places rules the others out.
    if (session.some((s) => same(s, gps.name))) return out;
  }
  const reason = session.length > 1
    ? `one of the session's ${session.length} locations — confirm which this photo shows`
    : "the session's only location (not confirmed for this photo)";
  session.forEach((s) => out.push(make("location", s, s, "high", "session", reason, "photo")));
  const sibling = session.length <= 1 ? agreed(ctx.siblings.locations) : null;
  if (sibling) {
    out.push(make("location", sibling.value, sibling.value, sibling.count >= 2 ? "high" : "medium", "siblings",
      `${sibling.count} other photo(s) from this session are tagged ${sibling.value}`, "photo"));
  }
  return out;
}

function locationSuggestions(ctx: SuggestionContext): TagSuggestion[] {
  const out = recordLocations(ctx);
  const caption = onePlace(ctx.captionText, ctx.places);
  if (caption) {
    out.push(make("location", caption.name, caption.name, "medium", "caption",
      `the photo's caption names ${caption.name}`, "photo"));
  }
  const analysis = onePlace(ctx.analysisText, ctx.places);
  if (analysis) {
    out.push(make("location", analysis.name, analysis.name, "medium", "analysis",
      `Content Engine analysis names ${analysis.name}`, "photo"));
  }
  return out;
}

/** Location facts that belong to the photo itself (lib/photoTagging/assemble). */
const OWN_LOCATION_SOURCES = new Set(["photo tag", "GPS"]);
/** Most spots one location can plausibly mean ("Doe Library" → entrance or ledge). */
const MAX_SPOT_CANDIDATES = 3;

function spotSuggestions(ctx: SuggestionContext, school: string): TagSuggestion[] {
  const label = (key: string) => spotsForSchool(school).find((s) => s.key === key)?.name ?? key;
  const spot = (text: string) => suggestSpotFromText(school, text)?.key ?? null;
  const out: TagSuggestion[] = [];
  const add = (key: string | null, confidence: Confidence, origin: SuggestionOrigin, reason: string) => {
    if (key) out.push(make("spot", key, label(key), confidence, origin, reason.replace("%s", label(key)), "photo"));
  };
  // A photographer-typed location names one spot → high. Naming a few
  // (bare "Doe Library") → each is offered for the photographer to choose.
  const typed = (text: string, origin: SuggestionOrigin, whose: string) => {
    const candidates = spotCandidatesFromText(school, text);
    if (candidates.length === 1) add(candidates[0].key, "high", origin, `${whose} names %s`);
    else if (candidates.length <= MAX_SPOT_CANDIDATES) {
      candidates.forEach((c) => add(c.key, "medium", origin, `${whose} "${text}" could be %s — choose the exact spot`));
    }
  };
  // The photo's own location beats its session's: session context is used
  // only when the photo has no location of its own.
  const own = ctx.facts.location && OWN_LOCATION_SOURCES.has(ctx.facts.location.source) ? ctx.facts.location.value : null;
  if (own) typed(own, "location", "the photo's location tag");
  else if (ctx.sessionLocations.length === 1) typed(ctx.sessionLocations[0], "session", "the session's location");
  add(spot(ctx.captionText), "medium", "caption", "the photo's caption names %s");
  add(spot(ctx.analysisText), "medium", "analysis", "Content Engine analysis names %s");
  return out;
}

function dedupe(list: readonly TagSuggestion[]): TagSuggestion[] {
  const best = new Map<string, TagSuggestion>();
  for (const s of list) {
    const prev = best.get(s.id);
    if (!prev || RANK[s.confidence] < RANK[prev.confidence]) best.set(s.id, s);
  }
  return [...best.values()];
}

/** Records naming different values for one field compete: each becomes medium, for the photographer to pick. */
function markCompeting(list: readonly TagSuggestion[]): TagSuggestion[] {
  const contested = new Set(list.map((s) => s.field).filter((field) => new Set(list
    .filter((s) => s.field === field && RECORD_ORIGINS.has(s.origin)).map((s) => s.value.toLowerCase())).size > 1));
  return list.map((s): TagSuggestion => (contested.has(s.field) && RECORD_ORIGINS.has(s.origin)
    ? { ...s, confidence: "medium", competing: true, reason: `${s.reason} — other records disagree; confirm which is right` }
    : s));
}

interface Needs { school: boolean; location: boolean; spotSchool: string | null }

function needsOf(facts: PhotoFacts): Needs {
  const grads = facts.category === "grads";
  const school = facts.school?.value && isSchoolSlug(facts.school.value) ? facts.school.value : null;
  return {
    school: grads && !facts.school,
    location: !facts.location && !facts.spot && !facts.notApplicable.includes("location"),
    spotSchool: grads && school && !facts.spot && facts.spotTaggable
      && !facts.notApplicable.includes("spot") && spotsForSchool(school).length > 0 ? school : null,
  };
}

function visionApplies(s: TagSuggestion, needs: Needs): boolean {
  if (s.field === "school") return needs.school;
  if (s.field === "location") return needs.location;
  if (s.field === "spot") return needs.spotSchool !== null && spotsForSchool(needs.spotSchool).some((d) => d.key === s.value);
  return false;
}

/** Suggestions for the fields this photo is missing, minus ones the photographer dismissed. */
export function suggestTags(ctx: SuggestionContext): TagSuggestion[] {
  const needs = needsOf(ctx.facts);
  const raw = [
    ...(needs.school ? schoolSuggestions(ctx) : []),
    ...(needs.location ? locationSuggestions(ctx) : []),
    ...(needs.spotSchool ? spotSuggestions(ctx, needs.spotSchool) : []),
    ...ctx.vision.filter((s) => visionApplies(s, needs)),
  ];
  const dismissed = new Set(ctx.dismissed);
  return markCompeting(dedupe(raw.filter((s) => !dismissed.has(s.id))))
    .sort((a, b) => RANK[a.confidence] - RANK[b.confidence]);
}
