// Deterministic location resolution. A session location is matched to a known
// place by IDENTITY — its normalized name equals one of the place's names or
// aliases — or by photo GPS falling inside the place's radius. There is no
// keyword or similarity matching: "a beach with cliffs" never becomes Ocean
// Beach, and an unknown name is sent to the photographer for confirmation.
// AI photo analysis can only be shown as a hint; it never identifies a place.
import type { KnownPlace } from "@/lib/locations/places";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationEvidence {
  /** Photographer-entered / booking location text (Priority 1–2). */
  sessionLocation: string | null | undefined;
  /** Median photo GPS, when the originals carried it (Priority 3). */
  gps: Coordinates | null;
  /** Frequent analysis tags — shown as hints only (Priority 4). */
  visualHints: string[];
}

export type ConfirmationReason = "missing" | "unrecognized" | "ambiguous" | "conflict";

export type LocationResolution =
  | {
      status: "verified";
      place: KnownPlace;
      source: "session_location" | "gps";
      /** Distance from the place center when GPS agreed, in meters. */
      gpsDistanceMeters: number | null;
    }
  | {
      status: "needs_confirmation";
      reason: ConfirmationReason;
      text: string | null;
      candidates: KnownPlace[];
      visualHints: string[];
    };

const DEFAULT_RADIUS_METERS = 750;
// GPS this far from the named place means the name or the photos are wrong.
const CONFLICT_DISTANCE_METERS = 5000;

const GENERIC_QUALIFIERS = new Set(["ca", "california", "usa", "us", "bay area", "the bay area"]);

/** Lowercase, strip accents/apostrophes/punctuation, "&" → "and", drop a leading "the". */
export function normalizePlaceName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

function namesOf(place: KnownPlace): Set<string> {
  return new Set([place.name, ...place.aliases].map(normalizePlaceName));
}

/** Splits "Shark Fin Cove, Santa Cruz" / "Shark Fin Cove in Davenport" into name + qualifiers. */
export function splitLocationText(text: string): { name: string; qualifiers: string[] } {
  const parts = text.split(/,|\(|\)|\s+-\s+|\s+(?:in|near|by)\s+/i)
    .map((p) => normalizePlaceName(p))
    .filter((p) => p.length > 0);
  return { name: parts[0] ?? "", qualifiers: parts.slice(1) };
}

function qualifierFits(place: KnownPlace, qualifier: string): boolean {
  if (GENERIC_QUALIFIERS.has(qualifier) || namesOf(place).has(qualifier)) return true;
  const accepted = [
    place.city, place.county, place.county.replace(/ county$/i, ""), place.searchArea,
    place.region, place.state, ...place.areaTerms,
  ].map(normalizePlaceName);
  return accepted.includes(qualifier);
}

/**
 * Places whose name/alias equals the text exactly (after normalization). A
 * qualifier ("…, Santa Cruz") must agree with the place's own geography, so
 * "Lovers Lane, Los Gatos" never resolves to the Presidio's Lovers' Lane.
 */
export function matchPlacesByName(text: string, places: readonly KnownPlace[]): KnownPlace[] {
  const whole = normalizePlaceName(text);
  if (!whole) return [];
  const exact = places.filter((p) => namesOf(p).has(whole));
  if (exact.length > 0) return exact;

  const { name, qualifiers } = splitLocationText(text);
  if (!name || qualifiers.length === 0) return [];
  return places.filter((p) => namesOf(p).has(name) && qualifiers.every((q) => qualifierFits(p, q)));
}

/** Great-circle distance in meters. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function coordsOf(place: KnownPlace): Coordinates | null {
  return typeof place.latitude === "number" && typeof place.longitude === "number"
    ? { latitude: place.latitude, longitude: place.longitude }
    : null;
}

/** The closest place whose radius contains the point, or null. */
export function placeAtCoordinates(
  point: Coordinates, places: readonly KnownPlace[],
): { place: KnownPlace; distance: number } | null {
  let best: { place: KnownPlace; distance: number } | null = null;
  for (const place of places) {
    const center = coordsOf(place);
    if (!center) continue;
    const distance = distanceMeters(point, center);
    if (distance > (place.radiusMeters ?? DEFAULT_RADIUS_METERS)) continue;
    if (!best || distance < best.distance) best = { place, distance };
  }
  return best;
}

function needsConfirmation(
  reason: ConfirmationReason, evidence: LocationEvidence, candidates: KnownPlace[] = [],
): LocationResolution {
  const text = evidence.sessionLocation?.trim() || null;
  return { status: "needs_confirmation", reason, text, candidates, visualHints: evidence.visualHints };
}

function resolveNamedLocation(
  text: string, evidence: LocationEvidence, places: readonly KnownPlace[],
): LocationResolution {
  const matches = matchPlacesByName(text, places);
  if (matches.length === 0) return needsConfirmation("unrecognized", evidence);
  if (matches.length > 1) return needsConfirmation("ambiguous", evidence, matches);

  const place = matches[0];
  const center = coordsOf(place);
  if (!evidence.gps || !center) {
    return { status: "verified", place, source: "session_location", gpsDistanceMeters: null };
  }
  const distance = distanceMeters(evidence.gps, center);
  if (distance > CONFLICT_DISTANCE_METERS) {
    const gpsPlace = placeAtCoordinates(evidence.gps, places)?.place;
    return needsConfirmation("conflict", evidence, gpsPlace ? [place, gpsPlace] : [place]);
  }
  return { status: "verified", place, source: "session_location", gpsDistanceMeters: Math.round(distance) };
}

/**
 * Evidence hierarchy: the photographer's session location wins; photo GPS
 * identifies a place only when no location was entered (and flags a conflict
 * when it contradicts the entered one); visual hints never identify anything.
 */
export function resolveLocation(
  evidence: LocationEvidence, places: readonly KnownPlace[],
): LocationResolution {
  const text = evidence.sessionLocation?.trim();
  if (text) return resolveNamedLocation(text, evidence, places);

  if (evidence.gps) {
    const hit = placeAtCoordinates(evidence.gps, places);
    if (hit) {
      return { status: "verified", place: hit.place, source: "gps", gpsDistanceMeters: Math.round(hit.distance) };
    }
  }
  return needsConfirmation("missing", evidence);
}

/** Median of each coordinate — robust to a stray photo from elsewhere. */
export function medianCoordinates(points: Coordinates[]): Coordinates | null {
  if (points.length === 0) return null;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  return {
    latitude: median(points.map((p) => p.latitude)),
    longitude: median(points.map((p) => p.longitude)),
  };
}

/** kebab-case slug of free text ("Shark Fin Cove" → "shark-fin-cove"). */
export function slugifyPlace(text: string): string {
  return normalizePlaceName(text).replace(/ /g, "-");
}
