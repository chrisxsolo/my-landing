// Plans "apply every high-confidence suggestion". Pure.
//
// Fills EMPTY fields only (never replaces). Medium suggestions always wait for
// the photographer. A field is held back as a "conflict" — never guessed —
// when:
//   · the photo has two high suggestions with different values, or any
//     suggestion marked competing (GPS vs session, several session places)
//   · photos of one session ask for different session-level values (plan.ts)
// photoOnly skips session-wide suggestions (a Content Engine photo's
// university), which the photographer confirms on their own.
// Evidence rules (owner): a location is assigned only from records — the
// photo's GPS inside a verified place (evidence gps) or the session's facts
// (evidence session). Image analysis (caption, analysis text, AI vision) is
// supporting evidence only: it is never applied here, whatever confidence it
// carries, and a photographer-set location is never overwritten (plan.ts).
// Safe to repeat: an applied field is no longer missing, so it is never
// suggested again — re-running after a partial failure only retries the rest.
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { outcome, planItems, type LocationSource, type PlanItem, type TagOutcome, type TagPlan } from "@/lib/photoTagging/plan";
import { evidenceOf, type LocationEvidence, type TagChanges, type TagSuggestion } from "@/lib/photoTagging/types";

export interface HighOptions { photoOnly?: boolean }

const BULK_FIELDS = ["school", "location", "spot"] as const;
type BulkField = (typeof BULK_FIELDS)[number];

interface Choice { item: PlanItem; held: TagOutcome[] }

function hold(entry: LibraryEntry, field: BulkField, high: readonly TagSuggestion[], all: readonly TagSuggestion[], opts: HighOptions) {
  const key = entry.photo.key;
  const scope = high.some((s) => s.appliesTo === "session") ? "session" : "photo";
  if (opts.photoOnly && scope === "session") {
    return outcome(key, field, "skipped", { scope, reason: "sets the whole session — review it on its own" });
  }
  const values = [...new Set(high.map((s) => s.value.toLowerCase()))];
  if (values.length > 1) {
    return outcome(key, field, "conflict", { scope, reason: `suggestions disagree (${high.map((s) => s.label).join(" vs ")}) — choose one` });
  }
  if (all.some((s) => s.competing)) {
    return outcome(key, field, "conflict", { scope, reason: "other records point to a different value — choose one" });
  }
  return null;
}

/** A location suggestion an automated step may act on: records, never image analysis. */
const fromRecords = (s: TagSuggestion) => s.field !== "location" || evidenceOf(s.origin) !== "vision";

function choose(entry: LibraryEntry, opts: HighOptions): Choice {
  const changes: TagChanges = {};
  const held: TagOutcome[] = [];
  let locationSource: LocationSource = "manual";
  let locationEvidence: LocationEvidence = "manual";
  for (const field of BULK_FIELDS) {
    const all = entry.photo.suggestions.filter((s) => s.field === field);
    const high = all.filter((s) => s.confidence === "high" && fromRecords(s));
    if (high.length === 0) continue;
    const blocked = hold(entry, field, high, all, opts);
    if (blocked) { held.push(blocked); continue; }
    changes[field] = high[0].value;
    if (field === "location") {
      locationEvidence = evidenceOf(high[0].origin);
      if (high[0].origin === "gps") locationSource = "gps";
    }
  }
  return { item: { target: entry.target, changes, locationSource, locationEvidence }, held };
}

export function planHighConfidence(entries: readonly LibraryEntry[], opts: HighOptions = {}): TagPlan {
  const choices = entries.map((e) => choose(e, opts));
  const plan = planItems(choices.map((c) => c.item), false, { automated: true });
  return { writes: plan.writes, outcomes: [...plan.outcomes, ...choices.flatMap((c) => c.held)] };
}
