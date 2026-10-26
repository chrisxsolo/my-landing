// Tag suggestions for a photo's MISSING fields, from records that already
// exist — no new AI call. Pure.
//
// Confidence follows the request's rules:
//   high   — reliable records: the session's own typed locations, the photo's
//            GPS inside a known place's radius, the photographer's location
//            tag naming one campus spot, or two+ photos from the same session
//            already tagged the same way. Offered for one-click "apply all".
//   medium — text written by AI (portfolio alt text, Content Engine analysis)
//            or AI vision. Shown for approval, never applied in bulk.
//   low    — not shown; the field stays flagged for manual review.
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
  /** Engine-only photos take school/location from their session. */
  appliesTo: "photo" | "session";
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
      `the session's location names ${schoolName(fromSession)}`, ctx.appliesTo));
  }
  const fromAnalysis = inferSchoolFromText(ctx.analysisText).school;
  if (fromAnalysis) {
    out.push(make("school", fromAnalysis, schoolName(fromAnalysis), "medium", "analysis",
      `Content Engine analysis mentions ${schoolName(fromAnalysis)}`, ctx.appliesTo));
  }
  return out;
}

function locationSuggestions(ctx: SuggestionContext): TagSuggestion[] {
  const out: TagSuggestion[] = [];
  if (ctx.gpsPlace) {
    out.push(make("location", ctx.gpsPlace.name, ctx.gpsPlace.name, "high", "gps",
      `the photo's GPS is inside ${ctx.gpsPlace.name}`, "photo"));
  }
  const sibling = agreed(ctx.siblings.locations);
  if (sibling) {
    out.push(make("location", sibling.value, sibling.value, sibling.count >= 2 ? "high" : "medium", "siblings",
      `${sibling.count} other photo(s) from this session are tagged ${sibling.value}`, "photo"));
  }
  const caption = onePlace(ctx.captionText, ctx.places);
  if (caption) {
    out.push(make("location", caption.name, caption.name, "medium", "caption",
      `the photo's caption names ${caption.name}`, ctx.appliesTo));
  }
  const analysis = onePlace(ctx.analysisText, ctx.places);
  if (analysis) {
    out.push(make("location", analysis.name, analysis.name, "medium", "analysis",
      `Content Engine analysis names ${analysis.name}`, ctx.appliesTo));
  }
  return out;
}

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
  if (ctx.facts.location?.source === "photo tag") typed(ctx.facts.location.value, "location", "the photo's location tag");
  if (ctx.sessionLocations.length === 1) typed(ctx.sessionLocations[0], "session", "the session's location");
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
  return [...best.values()].sort((a, b) => RANK[a.confidence] - RANK[b.confidence]);
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
  return dedupe(raw.filter((s) => !dismissed.has(s.id)));
}
