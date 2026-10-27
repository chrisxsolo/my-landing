// Ranking + filtering for the "Choose existing photo" picker. Pure functions
// (no server or Next imports) so the admin API and unit tests share them.
//
// A picker target is either a location guide gallery (couples / family /
// portrait, keyed by the static location slug, which equals the place key) or
// a grad campus-spot photo (keyed by location_spots.school_id).
//
// Priority tiers, lowest first:
//   0  already in this guide's gallery
//   1  from a session shot at this location (or, for grad spots, this school)
//   2  from another session of the same photography category
//   3  everything else in the Content Engine library
// Within a tier: approved before not-yet-approved, curated-in before
// curated-out, higher AI quality first.

import { normalizePlaceName } from "@/lib/locations/match";

export const GUIDE_TARGETS = ["couples", "family", "portrait"] as const;
export type GuideTarget = (typeof GUIDE_TARGETS)[number];

export type LibraryTarget =
  | { kind: "guide"; guide: GuideTarget; slug: string }
  | { kind: "gradSpot"; spotSchoolId: string }
  /** No destination to rank for (a journal cover, a replacement): every photo is a suggestion. */
  | { kind: "library" };

/** approved = has a public web copy; needs_approval = private original only. */
export type PhotoStatus = "approved" | "needs_approval" | "no_permission";

export const SUGGESTED_MAX_TIER = 2;

/** Engine service_type that matches each guide. */
const GUIDE_SERVICE: Record<GuideTarget, string> = {
  couples: "couples",
  family: "families",
  portrait: "portraits",
};

export function isGuideTarget(value: unknown): value is GuideTarget {
  return typeof value === "string" && (GUIDE_TARGETS as readonly string[]).includes(value);
}

export interface LibrarySession {
  id: string;
  name: string;
  serviceType: string;
  /** Engine school slug (grads), e.g. "uc-berkeley". */
  schoolSlug: string | null;
  /** Place keys the session's location text resolves to (may be empty). */
  placeKeys: string[];
  /** Filter key + label for the session's location. Null when unknown. */
  locationKey: string | null;
  locationLabel: string | null;
  permissionOk: boolean;
}

export interface LibraryPhoto {
  id: string;
  sessionId: string;
  hasDerivative: boolean;
  excluded: boolean;
  qualityScore: number | null;
  sortOrder: number;
  /** Set when this photo's web copy is already a row in the target gallery. */
  inGuide: { rowId: string; published: boolean; hero: boolean } | null;
}

export interface RankedPhoto extends LibraryPhoto {
  tier: number;
  status: PhotoStatus;
}

export interface LibraryFilters {
  /** Free-text search over session name and location. */
  q?: string;
  /** A LibrarySession.locationKey. */
  location?: string;
  /** An engine service_type. */
  category?: string;
  /** A /grads school slug (LibrarySession.schoolSlug). */
  school?: string;
  /** "suggested" keeps tiers 0-2; "all" shows the whole library. */
  scope?: "suggested" | "all";
}

export function photoStatus(photo: Pick<LibraryPhoto, "hasDerivative">, session: Pick<LibrarySession, "permissionOk">): PhotoStatus {
  if (!session.permissionOk) return "no_permission";
  return photo.hasDerivative ? "approved" : "needs_approval";
}

export function photoTier(
  photo: Pick<LibraryPhoto, "inGuide">,
  session: Pick<LibrarySession, "placeKeys" | "serviceType" | "schoolSlug">,
  target: LibraryTarget,
  spotSchoolSlug: string | null = null,
): number {
  if (target.kind === "library") return SUGGESTED_MAX_TIER;
  if (target.kind === "guide") {
    if (photo.inGuide) return 0;
    if (session.placeKeys.includes(target.slug)) return 1;
    return session.serviceType === GUIDE_SERVICE[target.guide] ? 2 : 3;
  }
  // School set on the session, or a shooting location that resolves to the
  // campus itself (place key == school slug). Ordering only; nothing publishes.
  if (spotSchoolSlug && (session.schoolSlug === spotSchoolSlug || session.placeKeys.includes(spotSchoolSlug))) return 1;
  return session.serviceType === "grads" ? 2 : 3;
}

const STATUS_ORDER: Record<PhotoStatus, number> = { approved: 0, needs_approval: 1, no_permission: 2 };

function compareRanked(a: RankedPhoto, b: RankedPhoto): number {
  return a.tier - b.tier
    || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || Number(a.excluded) - Number(b.excluded)
    || (b.qualityScore ?? 0) - (a.qualityScore ?? 0)
    || a.sessionId.localeCompare(b.sessionId)
    || a.sortOrder - b.sortOrder;
}

function matchesQuery(session: LibrarySession, q: string): boolean {
  const needle = normalizePlaceName(q);
  if (!needle) return true;
  const hay = normalizePlaceName(`${session.name} ${session.locationLabel ?? ""}`);
  return hay.includes(needle);
}

/** Tier, status, filter, and sort the library for one target. */
export function rankLibrary(
  photos: readonly LibraryPhoto[],
  sessions: ReadonlyMap<string, LibrarySession>,
  target: LibraryTarget,
  filters: LibraryFilters = {},
  spotSchoolSlug: string | null = null,
): RankedPhoto[] {
  const scope = filters.scope ?? "suggested";
  const ranked: RankedPhoto[] = [];
  for (const photo of photos) {
    const session = sessions.get(photo.sessionId);
    if (!session) continue;
    if (filters.category && session.serviceType !== filters.category) continue;
    if (filters.location && session.locationKey !== filters.location) continue;
    if (filters.school && session.schoolSlug !== filters.school) continue;
    if (filters.q && !matchesQuery(session, filters.q)) continue;
    const tier = photoTier(photo, session, target, spotSchoolSlug);
    if (scope === "suggested" && tier > SUGGESTED_MAX_TIER) continue;
    ranked.push({ ...photo, tier, status: photoStatus(photo, session) });
  }
  return ranked.sort(compareRanked);
}

/** Distinct location filter options across sessions, sorted by label. */
export function locationOptions(sessions: Iterable<LibrarySession>): { key: string; label: string }[] {
  const byKey = new Map<string, string>();
  for (const s of sessions) {
    if (s.locationKey && s.locationLabel && !byKey.has(s.locationKey)) byKey.set(s.locationKey, s.locationLabel);
  }
  return [...byKey].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
}
