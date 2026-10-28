// Session-location inheritance. Pure — the sync (inheritLocationSync.ts)
// loads, this reasons.
//
// A session whose facts name exactly ONE location — a non-empty primary
// location and no non-empty secondary location — is an explicit
// single-location shoot: every included photo was taken there. Those photos
// inherit it automatically instead of asking the photographer to approve the
// same fact once per photo. The stored shape is exactly what accepting the
// session-location suggestion in the review queue writes: photo_location =
// the location, photo_location_source = "manual", photo_location_evidence =
// "session", photo_location_confirmed_at = now.
//
// Precedence (owner rules, lib/photoTagging/plan.ts enforces it):
//   · a location the photographer set, a GPS match, or an accepted vision
//     suggestion is the photo's own fact — never filled over, never changed,
//     never cleared by this sync
//   · only a blank photo is filled, and only a session-inherited value
//     (evidence "session") follows the facts when they change:
//       empty / several → one   fill blank photos
//       one → another one       update inherited values
//       one → several / none    clear inherited values (photos are then
//                               assigned one by one, as before)
//   · a session with several entered locations never assigns one of them
//   · AI, caption and vision text never become an assignment here
//   · excluded photos are left alone: they were set aside by the photographer
//     and are not part of the library; including one later runs the sync again
// A recognized alias is canonicalized through the deterministic place matcher
// ("palace of fine arts" → "Palace of Fine Arts"); an unknown place keeps the
// photographer's trimmed text. No AI is involved. The plan is idempotent: a
// second run finds nothing to change.
import { matchPlacesByName } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { planItems, type PlanItem, type PlanTarget, type TagPlan } from "@/lib/photoTagging/plan";
import { enginePhotoKey, isLocationEvidence, type LocationEvidence } from "@/lib/photoTagging/types";

export const SESSION_EVIDENCE: LocationEvidence = "session";

export interface SessionLocationFacts {
  primary_location: string | null | undefined;
  secondary_locations: readonly unknown[] | null | undefined;
}

/** The session_photos columns the sync reads. */
export interface InheritablePhotoRow {
  id: string;
  excluded: boolean;
  photo_location: string | null;
  photo_location_source: string | null;
  photo_location_evidence: string | null;
}

const MAX_LOCATION_CHARS = 200;
const trimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The one place the session's facts name, or null when they name none or several. */
export function explicitSingleLocation(facts: SessionLocationFacts, places: readonly KnownPlace[]): string | null {
  const primary = trimmed(facts.primary_location).slice(0, MAX_LOCATION_CHARS);
  if (!primary) return null;
  if ((facts.secondary_locations ?? []).some((s) => trimmed(s) !== "")) return null;
  const hits = matchPlacesByName(primary, places);
  return hits.length === 1 ? hits[0].name : primary;
}

/** Whether a stored location came from the session's facts (and so follows them). */
export function isInheritedLocation(row: Pick<InheritablePhotoRow, "photo_location" | "photo_location_evidence">): boolean {
  return row.photo_location !== null && row.photo_location.trim() !== "" && row.photo_location_evidence === SESSION_EVIDENCE;
}

function targetOf(row: InheritablePhotoRow, sessionId: string): PlanTarget {
  const location = trimmed(row.photo_location) || null;
  const source = row.photo_location_source === "manual" || row.photo_location_source === "gps" ? row.photo_location_source : null;
  return {
    key: enginePhotoKey(row.id), source: "engine", portfolioId: null, enginePhotoId: row.id, sessionId, url: null,
    // Only the location matters to this plan; the other fields are never requested.
    category: null, school: null, location, spot: null,
    stored: { location },
    storedLocationSource: location ? source : null,
    storedLocationEvidence: location ? (isLocationEvidence(row.photo_location_evidence) ? row.photo_location_evidence : source) : null,
  };
}

const same = (a: string | null, b: string) => a !== null && a.trim().toLowerCase() === b.toLowerCase();

/**
 * The writes that bring the session's included photos in line with its
 * facts. Blank photos are filled without Replace; inherited values are
 * updated or cleared with Replace, which the planner allows an automated step
 * only for session evidence — so a manual, GPS or accepted-vision location
 * can never be touched even if a row were misread.
 */
export function planLocationInheritance(
  sessionId: string, facts: SessionLocationFacts, rows: readonly InheritablePhotoRow[], places: readonly KnownPlace[],
): TagPlan {
  const single = explicitSingleLocation(facts, places);
  const included = rows.filter((r) => !r.excluded);
  const fill: PlanItem[] = [];
  const follow: PlanItem[] = [];
  for (const row of included) {
    const target = targetOf(row, sessionId);
    const inherited = isInheritedLocation(row);
    if (single === null) {
      if (inherited) follow.push({ target, changes: { location: null } });
      continue;
    }
    const changes = { location: single, evidence: SESSION_EVIDENCE } as const;
    if (!target.location) fill.push({ target, changes, locationEvidence: SESSION_EVIDENCE });
    else if (inherited && !same(target.location, single)) follow.push({ target, changes, locationEvidence: SESSION_EVIDENCE });
  }
  const filled = planItems(fill, false, { automated: true });
  const followed = planItems(follow, true, { automated: true });
  return { writes: [...filled.writes, ...followed.writes], outcomes: [...filled.outcomes, ...followed.outcomes] };
}
