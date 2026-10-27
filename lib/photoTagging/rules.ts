// Tagging status rules. Pure — the audit, the API, and the tests all call it.
//
// Every photo:   category is CRITICAL (no category → Needs Tagging).
// Graduation:    university is CRITICAL; campus location is important;
//                campus spot is important only when it can be identified.
// Other types:   location is important; university and spot do not apply.
//
// "Not applicable" is decided, never guessed:
//   · university / spot on a non-graduation photo
//   · spot when the school has no campus-spot guide, the photo is not public
//     yet (spot tags key on the public URL), or nothing names an established
//     spot — "Do not require a spot when a photo does not clearly correspond"
//   · location / spot the photographer marked not applicable
// Status: any critical field missing → needs · any other field missing →
// partial · otherwise full.
import {
  categoryLabel, type LocationEvidence, type NotApplicableField, type TagCheck, type TagStatus, type TagSuggestion,
} from "@/lib/photoTagging/types";

export interface FactValue {
  /** Stored value: school slug, location text, or spot key. */
  value: string;
  /** What a person reads, when it differs from the value ("UC Berkeley"). */
  label?: string;
  source: string;
  /** A stored photo location's evidence level, when recorded. */
  evidence?: LocationEvidence | null;
}

export interface PhotoFacts {
  category: string | null;
  school: (FactValue & { builtIn: boolean }) | null;
  /** Why a graduation photo has no school (from lib/pagePhotos), if known. */
  schoolNote: string | null;
  location: FactValue | null;
  spot: FactValue | null;
  /** Campus spots the photo's school has a guide for (empty → spot n/a). */
  schoolSpotCount: number;
  spotTaggable: boolean;
  notApplicable: readonly NotApplicableField[];
}

const ok = (field: TagCheck["field"], critical: boolean, fact: FactValue): TagCheck => ({
  field, state: "ok", critical, value: fact.label ?? fact.value, source: fact.source, note: null,
  ...(fact.evidence ? { evidence: fact.evidence } : {}),
});
const missing = (field: TagCheck["field"], critical: boolean, note: string): TagCheck => ({
  field, state: "missing", critical, value: null, source: null, note,
});
const na = (field: TagCheck["field"], note: string): TagCheck => ({
  field, state: "na", critical: false, value: null, source: null, note,
});

function categoryCheck(facts: PhotoFacts): TagCheck {
  return facts.category
    ? ok("category", true, { value: facts.category, label: categoryLabel(facts.category), source: "photo category" })
    : missing("category", true, "no photography category");
}

function schoolCheck(facts: PhotoFacts): TagCheck {
  if (facts.category !== "grads") return na("school", "only graduation photos need a university");
  if (facts.school) {
    const check = ok("school", true, facts.school);
    return facts.school.builtIn ? check : { ...check, note: "custom school — it has no /grads page" };
  }
  return missing("school", true, facts.schoolNote ?? "no university tagged");
}

function locationCheck(facts: PhotoFacts): TagCheck {
  const label = facts.category === "grads" ? "campus location" : "location";
  if (facts.location) return ok("location", false, facts.location);
  if (facts.spot) return ok("location", false, { value: facts.spot.label ?? facts.spot.value, source: "campus spot" });
  if (facts.notApplicable.includes("location")) return na("location", "marked not applicable");
  return missing("location", false, `no ${label} tagged`);
}

function spotCheck(facts: PhotoFacts, suggestions: readonly TagSuggestion[]): TagCheck {
  if (facts.category !== "grads") return na("spot", "campus spots are for graduation photos");
  if (facts.spot) return ok("spot", false, facts.spot);
  if (!facts.school) return na("spot", "needs a university first");
  if (facts.schoolSpotCount === 0) return na("spot", "this school has no campus-spot guide");
  if (facts.notApplicable.includes("spot")) return na("spot", "marked not applicable");
  if (!facts.spotTaggable) return na("spot", "spot tags apply once the photo is public");
  return suggestions.some((s) => s.field === "spot")
    ? missing("spot", false, "a campus spot is identifiable but not tagged")
    : na("spot", "no established campus spot identified");
}

export function tagChecks(facts: PhotoFacts, suggestions: readonly TagSuggestion[]): TagCheck[] {
  return [categoryCheck(facts), schoolCheck(facts), locationCheck(facts), spotCheck(facts, suggestions)];
}

export function statusOf(checks: readonly TagCheck[]): TagStatus {
  const gaps = checks.filter((c) => c.state === "missing");
  if (gaps.some((c) => c.critical)) return "needs";
  return gaps.length > 0 ? "partial" : "full";
}
