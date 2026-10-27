// Pure planning for one session's location sync: which places the session was
// photographed at, which library rows must exist, which links to add or drop.
// Identity only — a session location is matched by name/alias (qualifiers
// must fit the place's geography) or, when no name was entered, by photo GPS.
// Scenery never identifies a place; anything unclear goes to review.
//
// Campuses come first and are never places: text naming a school or one of
// its on-campus spots ("Sather gate, doe library") is recorded as campus
// evidence for the session and handed to the campus-spot guide, so no
// bay_area_locations row or link is ever made from it.
import {
  campusOfPlace, campusPlaceEvidence, mergeCampusEvidence, splitCampusText, type CampusEvidence,
} from "@/lib/locationLibrary/campusEvidence";
import {
  matchPlacesByName, resolveLocation, type Coordinates, type LocationResolution,
} from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";

export type SyncStatus = "synced" | "needs_review" | "waiting" | "error";

export interface SyncSession {
  id: string;
  primaryLocation: string | null;
  secondaryLocations: string[];
  /** The graduate's school (photography_sessions.school_slug), when set. */
  schoolSlug: string | null;
  /** Median photo GPS, when originals carried it. */
  gps: Coordinates | null;
  /** At least one approved photo (public web copy) and marketing permission. */
  approved: boolean;
}

export interface LibraryRowRef {
  id: number;
  locationKey: string | null;
  aliasKeys: string[];
}

export interface SessionLinkRef {
  id: string;
  locationId: number;
  source: "auto" | "manual";
  excluded: boolean;
}

export interface UnresolvedLocation {
  text: string | null;
  reason: string;
  candidates: string[];
}

export interface ResolvedSession {
  places: KnownPlace[];
  unresolved: UnresolvedLocation[];
  /** Schools / campus spots the location text names — not places. */
  campus: CampusEvidence[];
}

export interface SyncPlan extends ResolvedSession {
  status: SyncStatus;
  message: string;
  /** Matched places with no library row yet — become review drafts. */
  createFor: KnownPlace[];
  /** Place keys whose rows need an auto link (rows may be created first). */
  linkKeys: string[];
  /** Auto links that no longer match the session's locations. */
  removeLinkIds: string[];
}

const SPLIT = /,|\/|;|\s+and\s+|\s+&\s+|\s+\+\s+/i;

const REASON_TEXT: Record<string, string> = {
  missing: "no session location entered",
  unrecognized: "not a verified place yet",
  ambiguous: "matches more than one place",
  conflict: "photo GPS disagrees with the entered name",
};

function unresolvedFrom(resolution: LocationResolution): UnresolvedLocation | null {
  if (resolution.status === "verified") return null;
  return {
    text: resolution.text,
    reason: REASON_TEXT[resolution.reason] ?? resolution.reason,
    candidates: resolution.candidates.map((p) => p.name),
  };
}

/**
 * "Sather Gate, Doe Library" may name two places. The whole text is tried
 * first (so "Shark Fin Cove, Santa Cruz" stays one place with a qualifier);
 * only when that fails are the parts tried, and EVERY part must match exactly
 * one place — otherwise the whole text goes to review.
 */
function resolveText(
  text: string, gps: Coordinates | null, places: readonly KnownPlace[], isPrimary: boolean,
): { places: KnownPlace[]; unresolved: UnresolvedLocation | null } {
  const whole = isPrimary
    ? resolveLocation({ sessionLocation: text, gps, visualHints: [] }, places)
    : resolveLocation({ sessionLocation: text, gps: null, visualHints: [] }, places);
  if (whole.status === "verified") return { places: [whole.place], unresolved: null };
  if (whole.status === "needs_confirmation" && whole.reason !== "unrecognized") {
    return { places: [], unresolved: unresolvedFrom(whole) };
  }
  const parts = text.split(SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { places: [], unresolved: unresolvedFrom(whole) };
  const hits = parts.map((p) => matchPlacesByName(p, places));
  if (hits.some((h) => h.length !== 1)) return { places: [], unresolved: unresolvedFrom(whole) };
  return { places: hits.map((h) => h[0]), unresolved: null };
}

export function rowForKey(rows: readonly LibraryRowRef[], key: string): LibraryRowRef | null {
  return rows.find((r) => r.locationKey === key) ?? rows.find((r) => r.aliasKeys.includes(key)) ?? null;
}

/** Campus text first, then each remaining part as a place. */
function resolveOne(
  text: string, session: SyncSession, places: readonly KnownPlace[], isPrimary: boolean, out: ResolvedSession,
): void {
  const split = splitCampusText(text, session.schoolSlug);
  out.campus.push(...split.campus);
  for (const part of split.remainder) {
    const r = resolveText(part, session.gps, places, isPrimary);
    for (const place of r.places) {
      const campus = campusPlaceEvidence(place, part);
      if (campus) out.campus.push(campus);
      else if (!out.places.some((p) => p.key === place.key)) out.places.push(place);
    }
    if (r.unresolved) out.unresolved.push(r.unresolved);
  }
}

/** All places the session's entered locations (or GPS) identify, what is campus, and what is unclear. */
export function resolveSessionPlaces(session: SyncSession, places: readonly KnownPlace[]): ResolvedSession {
  const primary = session.primaryLocation?.trim() || null;
  const texts = [primary, ...session.secondaryLocations.map((t) => t.trim())].filter((t): t is string => !!t);
  const out: ResolvedSession = { places: [], unresolved: [], campus: [] };

  if (texts.length === 0) {
    const byGps = resolveLocation({ sessionLocation: null, gps: session.gps, visualHints: [] }, places);
    if (byGps.status === "verified" && !campusOfPlace(byGps.place)) out.places.push(byGps.place);
    else if (byGps.status !== "verified") out.unresolved.push(unresolvedFrom(byGps)!);
  }
  texts.forEach((text, i) => resolveOne(text, session, places, i === 0 && text === primary, out));
  return { ...out, campus: mergeCampusEvidence(out.campus) };
}

function reviewMessage(unresolved: UnresolvedLocation[]): string {
  return unresolved
    .map((u) => (u.text ? `"${u.text}": ${u.reason}` : u.reason))
    .join("; ");
}

/** "Campus: UC Berkeley (Sather Gate, Doe Library Front Entrance) — campus-spot guide, not a Bay Area place." */
export function campusMessage(campus: readonly CampusEvidence[]): string {
  if (campus.length === 0) return "";
  const list = campus.map((c) => (c.spotKeys.length ? `${c.schoolName} (${c.spotKeys.join(", ")})` : c.schoolName));
  return `Campus: ${list.join("; ")} — kept with the campus-spot guide, not a Bay Area place.`;
}

const NO_CHANGES = { createFor: [], linkKeys: [], removeLinkIds: [] };

export function planSessionSync(
  session: SyncSession,
  places: readonly KnownPlace[],
  rows: readonly LibraryRowRef[],
  links: readonly SessionLinkRef[],
): SyncPlan {
  const resolved = resolveSessionPlaces(session, places);
  if (!session.approved) {
    return {
      status: "waiting", message: "No approved photos yet — the session joins the library once a photo is published.",
      ...resolved, ...NO_CHANGES,
    };
  }

  const createFor = resolved.places.filter((p) => !rowForKey(rows, p.key));
  const matchedIds = new Set(
    resolved.places.map((p) => rowForKey(rows, p.key)?.id).filter((id): id is number => id !== undefined),
  );
  const removeLinkIds = links
    .filter((l) => l.source === "auto" && !l.excluded && !matchedIds.has(l.locationId))
    .map((l) => l.id);

  const status: SyncStatus = resolved.unresolved.length > 0 ? "needs_review" : "synced";
  const names = resolved.places.map((p) => p.name).join(", ");
  const matched = names ? `Matched ${names}. ` : "";
  const message = [
    status === "needs_review" ? `${matched}Needs a location: ${reviewMessage(resolved.unresolved)}` : matched.trim(),
    campusMessage(resolved.campus),
  ].filter(Boolean).join(" ") || "No place to match.";
  return {
    status, message, ...resolved,
    createFor, linkKeys: resolved.places.map((p) => p.key), removeLinkIds,
  };
}
