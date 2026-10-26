// Plans the writes for a bulk (or single-photo) tag edit. Pure.
//
// Preserve by default: a field is written only when the photo has NO
// effective value for it (from any source the site uses — photo tag, session,
// caption). With replace=true the requested value overwrites. Fields the
// request leaves out are never touched.
//
// Where each field lives (existing columns only):
//   portfolio photo → portfolio_images.category_slug / school / location
//   engine-only photo → its session's school_slug / primary_location (so the
//                       value reaches every photo of that session); category
//                       is the session's service type and is changed in
//                       Session facts, not here
//   campus spot     → school_spot_photos, keyed by the PUBLIC url, so only
//                     public photos of a school with a spot guide can carry one
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { isSchoolSpotKey } from "@/lib/schoolSpots";
import type { PhotoSource, TagChanges, TagField } from "@/lib/photoTagging/types";

export interface PlanTarget {
  key: string;
  source: PhotoSource;
  portfolioId: number | null;
  sessionId: string | null;
  url: string | null;
  /** Current effective values (any source). */
  category: string | null;
  school: string | null;
  location: string | null;
  spot: string | null;
}

export interface PortfolioPatch { category?: string; school?: string | null; location?: string | null }
export interface SessionPatch { school_slug?: string | null; primary_location?: string | null }

export type TagWrite =
  | { kind: "portfolio"; portfolioId: number; patch: PortfolioPatch }
  | { kind: "session"; sessionId: string; patch: SessionPatch }
  | { kind: "spot"; school: string; url: string; spotKey: string | null };

export interface TagOutcome {
  key: string;
  field: TagField;
  result: "updated" | "kept" | "skipped";
  reason: string | null;
}

export interface TagPlan { writes: TagWrite[]; outcomes: TagOutcome[] }

interface TargetPlan {
  portfolio: PortfolioPatch;
  session: SessionPatch;
  spot: { school: string; spotKey: string | null } | null;
  outcomes: TagOutcome[];
}

const blank = (v: string | null | undefined) => v === null || v === undefined || v.trim() === "";
const clean = (v: string | null) => (v === null ? null : v.trim().slice(0, 200) || null);

/** Whether to write: an empty field always; a filled one only in replace mode; clearing only in replace mode. */
function decide(current: string | null, next: string | null, replace: boolean): "write" | "kept" | "same" {
  if (next === null) return replace && !blank(current) ? "write" : "same";
  if (!blank(current) && current?.toLowerCase() === next.toLowerCase()) return "same";
  return blank(current) || replace ? "write" : "kept";
}

function planTarget(t: PlanTarget, changes: TagChanges, replace: boolean): TargetPlan {
  const plan: TargetPlan = { portfolio: {}, session: {}, spot: null, outcomes: [] };
  const note = (field: TagField, result: TagOutcome["result"], reason: string | null = null) =>
    plan.outcomes.push({ key: t.key, field, result, reason });
  const keptReason = "already set — turn on Replace to overwrite";
  let category = t.category;
  let school = t.school;

  if (changes.category !== undefined) {
    if (t.source === "engine") note("category", "skipped", "set the session's service type in Session facts");
    else {
      const d = decide(t.category, changes.category, replace);
      if (d === "write") { plan.portfolio.category = changes.category; category = changes.category; note("category", "updated"); }
      else note("category", "kept", d === "kept" ? keptReason : "unchanged");
    }
  }
  if (changes.school !== undefined) {
    const next = clean(changes.school);
    const d = decide(t.school, next, replace);
    if (category !== "grads") note("school", "skipped", "only graduation photos take a university");
    else if (t.source === "portfolio" && next !== null && !isSchoolSlug(next)) {
      note("school", "skipped", "portfolio photos take a school that has a /grads page");
    } else if (d === "write") {
      if (t.source === "portfolio" && t.portfolioId !== null) plan.portfolio.school = next;
      else if (t.sessionId) plan.session.school_slug = next;
      school = next;
      note("school", "updated", t.source === "engine" ? "set on the session" : null);
    } else note("school", "kept", d === "kept" ? keptReason : "unchanged");
  }
  if (changes.location !== undefined) {
    const next = clean(changes.location);
    const d = decide(t.location, next, replace);
    if (d === "write") {
      if (t.source === "portfolio") plan.portfolio.location = next;
      else if (t.sessionId) plan.session.primary_location = next;
      note("location", "updated", t.source === "engine" ? "set on the session" : null);
    } else note("location", "kept", d === "kept" ? keptReason : "unchanged");
  }
  if (changes.spot !== undefined) planSpot(t, changes.spot, replace, school, plan, note, keptReason);
  return plan;
}

function planSpot(
  t: PlanTarget, spotKey: string | null, replace: boolean, school: string | null, plan: TargetPlan,
  note: (field: TagField, result: TagOutcome["result"], reason?: string | null) => void, keptReason: string,
): void {
  if (!t.url) return note("spot", "skipped", "spot tags apply once the photo is public");
  if (!school || !isSchoolSlug(school)) return note("spot", "skipped", "needs a university with a campus-spot guide");
  if (spotKey !== null && !isSchoolSpotKey(school, spotKey)) {
    return note("spot", "skipped", `not one of ${school}'s campus spots`);
  }
  const d = decide(t.spot, spotKey, replace);
  if (d !== "write") return note("spot", "kept", d === "kept" ? keptReason : "unchanged");
  plan.spot = { school, spotKey };
  note("spot", "updated");
}

/** One plan for many photos. Session patches are merged so a session is written once. */
export function planTagChanges(targets: readonly PlanTarget[], changes: TagChanges, replace: boolean): TagPlan {
  const writes: TagWrite[] = [];
  const outcomes: TagOutcome[] = [];
  const sessions = new Map<string, SessionPatch>();
  for (const t of targets) {
    const plan = planTarget(t, changes, replace);
    outcomes.push(...plan.outcomes);
    if (Object.keys(plan.portfolio).length > 0 && t.portfolioId !== null) {
      writes.push({ kind: "portfolio", portfolioId: t.portfolioId, patch: plan.portfolio });
    }
    if (Object.keys(plan.session).length > 0 && t.sessionId) {
      sessions.set(t.sessionId, { ...sessions.get(t.sessionId), ...plan.session });
    }
    if (plan.spot && t.url) writes.push({ kind: "spot", school: plan.spot.school, url: t.url, spotKey: plan.spot.spotKey });
  }
  for (const [sessionId, patch] of sessions) writes.push({ kind: "session", sessionId, patch });
  return { writes, outcomes };
}
