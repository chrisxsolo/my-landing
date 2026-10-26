// Pure planning for one session's location sync: which places the session was
// photographed at, which library rows must exist, which links to add or drop.
// Identity only — a session location is matched by name/alias (qualifiers
// must fit the place's geography) or, when no name was entered, by photo GPS.
// Scenery never identifies a place; anything unclear goes to review.
import {
  matchPlacesByName, resolveLocation, type Coordinates, type LocationResolution,
} from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";

export type SyncStatus = "synced" | "needs_review" | "waiting" | "error";

export interface SyncSession {
  id: string;
  primaryLocation: string | null;
  secondaryLocations: string[];
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

export interface SyncPlan {
  status: SyncStatus;
  message: string;
  places: KnownPlace[];
  unresolved: UnresolvedLocation[];
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

/** All places the session's entered locations (or GPS) identify, plus what is unclear. */
export function resolveSessionPlaces(
  session: SyncSession, places: readonly KnownPlace[],
): { places: KnownPlace[]; unresolved: UnresolvedLocation[] } {
  const primary = session.primaryLocation?.trim() || null;
  const texts = [primary, ...session.secondaryLocations.map((t) => t.trim())].filter((t): t is string => !!t);
  const found = new Map<string, KnownPlace>();
  const unresolved: UnresolvedLocation[] = [];

  if (texts.length === 0) {
    const byGps = resolveLocation({ sessionLocation: null, gps: session.gps, visualHints: [] }, places);
    if (byGps.status === "verified") found.set(byGps.place.key, byGps.place);
    else unresolved.push(unresolvedFrom(byGps)!);
  }
  texts.forEach((text, i) => {
    const r = resolveText(text, session.gps, places, i === 0 && text === primary);
    r.places.forEach((p) => found.set(p.key, p));
    if (r.unresolved) unresolved.push(r.unresolved);
  });
  return { places: [...found.values()], unresolved };
}

function reviewMessage(unresolved: UnresolvedLocation[]): string {
  return unresolved
    .map((u) => (u.text ? `"${u.text}": ${u.reason}` : u.reason))
    .join("; ");
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
      places: resolved.places, unresolved: resolved.unresolved, ...NO_CHANGES,
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
  const message = status === "needs_review"
    ? `${names ? `Matched ${names}. ` : ""}Needs a location: ${reviewMessage(resolved.unresolved)}`
    : `Matched ${names}.`;
  return {
    status, message, places: resolved.places, unresolved: resolved.unresolved,
    createFor, linkKeys: resolved.places.map((p) => p.key), removeLinkIds,
  };
}
