// Filtering and counting audited photos. Pure — the API's summary counts and
// the admin grids' filters use the same predicates, so the numbers on the
// health card always equal what the filter shows.
import type { AuditedPhoto, TagCounts, TagFilter, TagFilterState } from "@/lib/photoTagging/types";

export const DEFAULT_TAG_FILTER: TagFilterState = { filter: "all", category: "", school: "" };

const missing = (photo: AuditedPhoto, field: string) =>
  photo.checks.some((c) => c.field === field && c.state === "missing");

export function matchesTagFilter(photo: AuditedPhoto, filter: TagFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "full":
    case "partial":
    case "needs": return photo.status === filter;
    case "grads-missing-school": return photo.category === "grads" && missing(photo, "school");
    case "grads-missing-location": return photo.category === "grads" && missing(photo, "location");
    case "suggestions": return photo.suggestions.some((s) => s.field === "location" || s.field === "spot");
  }
}

export function matchesFilterState(photo: AuditedPhoto, state: TagFilterState): boolean {
  if (!matchesTagFilter(photo, state.filter)) return false;
  if (state.category && photo.category !== state.category) return false;
  if (state.school === "none") return photo.category === "grads" && !photo.school;
  if (state.school && photo.school !== state.school) return false;
  return true;
}

export function countTags(photos: readonly AuditedPhoto[]): TagCounts {
  const count = (test: (p: AuditedPhoto) => boolean) => photos.filter(test).length;
  return {
    total: photos.length,
    published: count((p) => p.published),
    full: count((p) => p.status === "full"),
    partial: count((p) => p.status === "partial"),
    needs: count((p) => p.status === "needs"),
    gradsMissingSchool: count((p) => matchesTagFilter(p, "grads-missing-school")),
    gradsMissingLocation: count((p) => matchesTagFilter(p, "grads-missing-location")),
    unresolvedLocation: count((p) => matchesTagFilter(p, "suggestions")),
    highConfidence: count((p) => p.suggestions.some((s) => s.confidence === "high")),
  };
}

/** How many photos a filter chip would show (for the chip's count). */
export function filterCount(counts: TagCounts, filter: TagFilter): number {
  const map: Record<TagFilter, number> = {
    all: counts.total,
    full: counts.full,
    partial: counts.partial,
    needs: counts.needs,
    "grads-missing-school": counts.gradsMissingSchool,
    "grads-missing-location": counts.gradsMissingLocation,
    suggestions: counts.unresolvedLocation,
  };
  return map[filter];
}
