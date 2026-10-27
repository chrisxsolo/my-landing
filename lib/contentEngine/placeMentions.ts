// Deterministic check that a journal post only names places this session was
// actually photographed at. The model may describe the session's own
// locations; it must never recommend or pair a place just because it is
// nearby. A named known place outside the session's locations (or its school)
// blocks publishing until Chris removes it or records that he shot there.
//
// Each mention of another place is one of three things:
//   claim     — the post says the session happened there ("we shot at X",
//               "we finished at [X](…)"). Always blocked, even in link text.
//   reference — the post points readers to a guide or article about X: link
//               text, "our X guide", "guide to X", a "See also"/"Related" line
//               or section, "Planning a session at X? The [guide](…)". Allowed.
//   mention   — any other naming of X in prose. Blocked, as before.
import { matchPlacesByName, normalizePlaceName } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { referenceSpans, isClaim, isReference, type Span } from "@/lib/contentEngine/placeMentionContext";

export interface SessionPlaceContext {
  /** Locations the post may name as where the session happened. */
  locations: readonly string[];
  /** The graduate's school names, so a campus that is also a known place is allowed. */
  schoolNames: readonly string[];
}

/** One source of location facts: the live session, or a generation-time snapshot. */
export interface LocationFacts {
  locations: readonly string[];
  schoolSlug: string | null;
  schoolNames: readonly string[];
}

export interface ResolvedPlaceContext extends SessionPlaceContext {
  /** Where `locations` came from; "snapshot" is the fallback, see placeContextFor. */
  source: "session" | "snapshot";
}

const present = (values: readonly string[]) => values.map((v) => v.trim()).filter(Boolean);

/**
 * Which locations a post may claim. Current facts win: the session's own
 * primary/secondary locations plus the confirmed photo-level locations of the
 * photos in the post. The snapshot stored when the post was generated is used
 * ONLY when the live session has no location facts at all (older sessions
 * that never recorded one) — a location corrected on the Session never stays
 * allowed because an old snapshot still has it. The snapshot's school names
 * count only while the session still has that school.
 */
export function placeContextFor(
  live: LocationFacts, photoLocations: readonly string[], snapshot: LocationFacts,
): ResolvedPlaceContext {
  const current = present([...live.locations, ...photoLocations]);
  const sameSchool = !live.schoolSlug || live.schoolSlug === snapshot.schoolSlug;
  const schoolNames = present([...live.schoolNames, ...(sameSchool ? snapshot.schoolNames : [])]);
  return current.length > 0
    ? { locations: current, schoolNames, source: "session" }
    : { locations: present(snapshot.locations), schoolNames, source: "snapshot" };
}

export interface PostField {
  field: string;
  text: string;
}

export interface PlaceIssue {
  place: string;
  field: string;
  /** The words around the mention, as written. */
  excerpt: string;
  /** True when the text says the session happened there. */
  claim: boolean;
}

interface Token {
  norm: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{M}\p{N}'’`]+|&/gu;
const EXCERPT_CHARS = 50;

function tokenize(text: string, skip: readonly Span[]): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    const start = m.index;
    if (skip.some((s) => start >= s.start && start < s.end)) continue;
    const norm = normalizePlaceName(m[0]);
    if (norm) tokens.push({ norm, start, end: start + m[0].length });
  }
  return tokens;
}

function placeNames(place: KnownPlace): string[][] {
  return [place.name, ...place.aliases].map(normalizePlaceName)
    .filter((n) => n.length > 3).map((n) => n.split(" "));
}

function namedIn(place: KnownPlace, normalizedText: string): boolean {
  return placeNames(place).some((n) => normalizedText.includes(` ${n.join(" ")} `));
}

// A place counts as the session's own when a recorded location resolves to it
// ("Palace of Fine Arts, San Francisco") or names it ("USF and Palace of Fine Arts").
function sessionPlaceKeys(ctx: SessionPlaceContext, places: readonly KnownPlace[]): Set<string> {
  const recorded = [...ctx.locations, ...ctx.schoolNames].filter((t) => t.trim());
  const recordedText = ` ${recorded.map(normalizePlaceName).join("  ")} `;
  const resolved = recorded.flatMap((text) => matchPlacesByName(text, places).map((p) => p.key));
  return new Set([...resolved, ...places.filter((p) => namedIn(p, recordedText)).map((p) => p.key)]);
}

/** Character ranges where `names` occur as whole words. */
function occurrences(tokens: readonly Token[], names: readonly string[][]): Span[] {
  const found: Span[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const hit = names.find((n) => n.every((word, k) => tokens[i + k]?.norm === word));
    if (hit) found.push({ start: tokens[i].start, end: tokens[i + hit.length - 1].end });
  }
  return found;
}

function excerptOf(text: string, at: Span): string {
  const from = Math.max(0, at.start - EXCERPT_CHARS);
  const to = Math.min(text.length, at.end + EXCERPT_CHARS);
  const core = text.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${core}${to < text.length ? "…" : ""}`;
}

function fieldIssues(field: PostField, others: readonly KnownPlace[]): PlaceIssue[] {
  const spans = referenceSpans(field.text);
  const tokens = tokenize(field.text, spans.urls);
  return others.flatMap((place) => occurrences(tokens, placeNames(place)).flatMap((at) => {
    const claim = isClaim(field.text, at, spans);
    if (!claim && isReference(field.text, at, spans)) return [];
    return [{ place: place.name, field: field.field, excerpt: excerptOf(field.text, at), claim }];
  }));
}

/** Mentions of known places this session was not photographed at, in reading order per field. */
export function findPlaceIssues(
  fields: readonly PostField[], ctx: SessionPlaceContext, places: readonly KnownPlace[],
): PlaceIssue[] {
  const own = sessionPlaceKeys(ctx, places);
  const others = places.filter((p) => !own.has(p.key));
  return fields.flatMap((f) => fieldIssues(f, others));
}

const MAX_LISTED = 5;

function issueLine(issue: PlaceIssue): string {
  const what = issue.claim
    ? `says the session was at ${issue.place}`
    : `names ${issue.place}`;
  return `• ${issue.field} ${what}: "${issue.excerpt}"`;
}

/** An actionable publish-block message: which place, where, and what to do. */
export function describePlaceIssues(issues: readonly PlaceIssue[], ctx: ResolvedPlaceContext): string {
  const listed = issues.slice(0, MAX_LISTED).map(issueLine);
  const more = issues.length > MAX_LISTED ? [`• …and ${issues.length - MAX_LISTED} more`] : [];
  const known = ctx.locations.length ? ctx.locations.join("; ") : "none recorded";
  const source = ctx.source === "snapshot"
    ? " (the Session has no location, so the locations saved when this post was generated were used)"
    : "";
  return [
    "this post names places this session was not photographed at:",
    ...listed, ...more,
    `This session's locations: ${known}${source}.`,
    "To fix: if you photographed there, add the place to the Session's locations in Session facts (or confirm it on the photo); otherwise remove or reword the mention — a link to that place's guide is fine.",
  ].join("\n");
}
