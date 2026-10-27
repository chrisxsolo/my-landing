// The tagging review queue: what the photographer should look at next, most
// important first. Pure — built from the live audit, so a field that is
// already verified (state "ok") or marked not applicable never shows up.
//
//   1. graduation photos missing a university
//   2. photos whose location records disagree (competing suggestions)
//   3. photos missing other important categorization (category, location)
//   4. campus spots that can be identified but are not tagged
//
// Each item shows what accepting would change (before → after). An item is
// "safe" to approve in bulk only when it has exactly one high-confidence,
// non-competing, photo-scoped answer — the same rule the server applies with
// apply-high + photoOnly (lib/photoTagging/highConfidence.ts).
import type { AuditedPhoto, TagCheck, TagField, TagSuggestion } from "@/lib/photoTagging/types";

export type QueueKind = "school" | "location-conflict" | "categorization" | "spot";

export const QUEUE_PRIORITY: Record<QueueKind, number> = {
  school: 1, "location-conflict": 2, categorization: 3, spot: 4,
};

export const QUEUE_LABELS: Record<QueueKind, string> = {
  school: "Graduation photo missing a university",
  "location-conflict": "Location records disagree — pick one",
  categorization: "Missing categorization",
  spot: "Campus spot to confirm",
};

export interface QueueItem {
  /** `${photoKey}:${field}` */
  id: string;
  key: string;
  kind: QueueKind;
  field: TagField;
  title: string;
  /** What the photo has now (null = nothing). */
  before: string | null;
  /** Answers to choose from, best first. Empty = needs a manual pick in the editor. */
  options: TagSuggestion[];
  safe: boolean;
}

function kindOf(photo: AuditedPhoto, check: TagCheck, options: readonly TagSuggestion[]): QueueKind | null {
  if (check.field === "school") return photo.category === "grads" ? "school" : null;
  if (check.field === "spot") return options.length > 0 ? "spot" : null;
  if (check.field === "location" && isContested(options)) return "location-conflict";
  return "categorization";
}

function isContested(options: readonly TagSuggestion[]): boolean {
  return options.some((s) => s.competing) || new Set(options.filter((s) => s.confidence === "high")
    .map((s) => s.value.toLowerCase())).size > 1;
}

function isSafe(options: readonly TagSuggestion[]): boolean {
  const high = options.filter((s) => s.confidence === "high");
  return high.length > 0 && !isContested(options) && high.every((s) => s.appliesTo === "photo");
}

function itemsFor(photo: AuditedPhoto): QueueItem[] {
  return photo.checks.filter((c) => c.state === "missing").flatMap((check): QueueItem[] => {
    const options = photo.suggestions.filter((s) => s.field === check.field);
    const kind = kindOf(photo, check, options);
    if (!kind) return [];
    return [{
      id: `${photo.key}:${check.field}`, key: photo.key, kind, field: check.field,
      title: photo.sessionName ?? photo.title, before: check.value, options, safe: isSafe(options),
    }];
  });
}

export function buildReviewQueue(photos: readonly AuditedPhoto[]): QueueItem[] {
  return photos.flatMap(itemsFor).sort((a, b) => QUEUE_PRIORITY[a.kind] - QUEUE_PRIORITY[b.kind]
    || Number(b.options.length > 0) - Number(a.options.length > 0)
    || a.title.localeCompare(b.title));
}

/** Photo keys whose queue items can all be approved in bulk. */
export function safeKeys(items: readonly QueueItem[]): string[] {
  return [...new Set(items.filter((i) => i.safe).map((i) => i.key))];
}
