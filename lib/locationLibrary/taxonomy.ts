// Closed vocabularies for the Bay Area location library: regions, photography
// environments, session kinds and the editorial fields an admin can lock.
// Client-safe (no server imports) — the public filters and admin UI use it.
import type { KnownPlace } from "@/lib/locations/places";

export const LOCATIONS_TABLE = "bay_area_locations";
export const LOCATION_SESSIONS_TABLE = "location_sessions";
export const PHOTO_OVERRIDES_TABLE = "location_photo_overrides";
export const PUBLIC_LOCATIONS_PATH = "/bay-area-locations";

export const LIBRARY_REGIONS = [
  { value: "san-francisco", label: "San Francisco", short: "SF" },
  { value: "south-bay", label: "South Bay", short: "South Bay" },
  { value: "east-bay", label: "East Bay", short: "East Bay" },
  { value: "peninsula", label: "Peninsula", short: "Peninsula" },
  { value: "north-bay", label: "North Bay", short: "North Bay" },
  { value: "coast", label: "Santa Cruz / Coast", short: "Coast" },
  { value: "other", label: "Other Bay Area", short: "Other" },
] as const;
export type LibraryRegion = (typeof LIBRARY_REGIONS)[number]["value"];

export const ENVIRONMENTS = [
  { value: "architecture", label: "Architecture", short: "Architecture" },
  { value: "urban", label: "City / Urban", short: "Urban" },
  { value: "nature", label: "Nature", short: "Nature" },
  { value: "beach", label: "Beach / Coastal", short: "Beaches" },
  { value: "garden", label: "Garden / Flowers", short: "Gardens" },
  { value: "forest", label: "Forest / Redwoods", short: "Forests" },
  { value: "mountains", label: "Mountains / Hills", short: "Hills" },
  { value: "waterfront", label: "Waterfront", short: "Waterfront" },
  { value: "campus", label: "Campus / University", short: "Campus" },
  { value: "historic", label: "Historic Landmarks", short: "Historic" },
] as const;
export type Environment = (typeof ENVIRONMENTS)[number]["value"];

export const SESSION_KINDS = [
  { value: "couples", label: "Couples" },
  { value: "graduation", label: "Graduation" },
  { value: "portraits", label: "Portraits" },
  { value: "family", label: "Family" },
  { value: "maternity", label: "Maternity" },
  { value: "engagement", label: "Engagement" },
  { value: "proposal", label: "Proposals" },
  { value: "elopement", label: "Elopements" },
] as const;
export type SessionKind = (typeof SESSION_KINDS)[number]["value"];

/** Editorial fields an admin edit locks against sync and AI. */
export const LOCKABLE_FIELDS = [
  "title", "city", "neighborhood", "region", "description", "best_for", "best_time", "tip", "environments",
] as const;
export type LockableField = (typeof LOCKABLE_FIELDS)[number];

/** Fields the AI profile may fill (when unlocked). */
export const AI_FIELDS = ["description", "best_for", "best_time", "tip", "environments"] as const;
export type AiField = (typeof AI_FIELDS)[number];

const values = <T extends { value: string }>(list: readonly T[]) => list.map((i) => i.value) as string[];

export const isLibraryRegion = (v: unknown): v is LibraryRegion =>
  typeof v === "string" && values(LIBRARY_REGIONS).includes(v);
export const isEnvironment = (v: unknown): v is Environment =>
  typeof v === "string" && values(ENVIRONMENTS).includes(v);
export const isSessionKind = (v: unknown): v is SessionKind =>
  typeof v === "string" && values(SESSION_KINDS).includes(v);
export const isLockableField = (v: unknown): v is LockableField =>
  typeof v === "string" && (LOCKABLE_FIELDS as readonly string[]).includes(v);

export function regionLabel(value: string, short = false): string {
  const hit = LIBRARY_REGIONS.find((r) => r.value === value);
  return hit ? (short ? hit.short : hit.label) : value;
}
export function environmentLabel(value: string, short = false): string {
  const hit = ENVIRONMENTS.find((e) => e.value === value);
  return hit ? (short ? hit.short : hit.label) : value;
}
export function sessionKindLabel(value: string): string {
  return SESSION_KINDS.find((k) => k.value === value)?.label ?? value;
}

const REGION_BY_AREA: Record<string, LibraryRegion> = {
  "san francisco": "san-francisco",
  "san francisco county": "san-francisco",
  "south bay": "south-bay",
  "santa clara county": "south-bay",
  "east bay": "east-bay",
  "alameda county": "east-bay",
  "contra costa county": "east-bay",
  peninsula: "peninsula",
  "san mateo county": "peninsula",
  "north bay": "north-bay",
  "marin county": "north-bay",
  "sonoma county": "north-bay",
  "napa county": "north-bay",
  "solano county": "north-bay",
  "santa cruz county": "coast",
  "monterey county": "coast",
};

/**
 * Library region from VERIFIED geography only: the place's own region chip
 * first ("Peninsula" for Palo Alto), then its county. Never from scenery.
 */
export function regionForPlace(place: Pick<KnownPlace, "region" | "county">): LibraryRegion {
  const byRegion = REGION_BY_AREA[place.region.trim().toLowerCase()];
  if (byRegion) return byRegion;
  return REGION_BY_AREA[place.county.trim().toLowerCase()] ?? "other";
}

/**
 * Session kinds a session proves. Only real session data counts: the service
 * type, plus the couples relationship type for engagements and proposals.
 */
export function sessionKindsFor(serviceType: string | null, relationshipType: string | null): SessionKind[] {
  switch (serviceType) {
    case "grads": return ["graduation"];
    case "families": return ["family"];
    case "portraits": return ["portraits"];
    case "maternity": return ["maternity"];
    case "elopement": return ["elopement"];
    case "couples": {
      if (relationshipType === "engagement") return ["couples", "engagement"];
      if (relationshipType === "proposal") return ["couples", "proposal"];
      return ["couples"];
    }
    default: return [];
  }
}

/** Orders kinds by the closed list so chips read the same everywhere. */
export function sortKinds(kinds: Iterable<string>): SessionKind[] {
  const set = new Set(kinds);
  return SESSION_KINDS.map((k) => k.value).filter((k) => set.has(k));
}

export function sortEnvironments(envs: Iterable<string>): Environment[] {
  const set = new Set(envs);
  return ENVIRONMENTS.map((e) => e.value).filter((e) => set.has(e));
}
