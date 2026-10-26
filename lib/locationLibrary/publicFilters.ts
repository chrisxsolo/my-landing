// Pure filtering, sorting and facet counts for the public location guide.
// Filters combine (region AND environment AND session type AND search).
import {
  ENVIRONMENTS, LIBRARY_REGIONS, SESSION_KINDS, environmentLabel, regionLabel, sessionKindLabel,
} from "@/lib/locationLibrary/taxonomy";

export interface FilterableLocation {
  title: string;
  city: string;
  neighborhood: string | null;
  description: string;
  best_for: string;
  best_time: string;
  tip: string;
  region: string;
  tags: string[];
  environments: string[];
  kinds: string[];
  order: number;
  photoCount: number;
  sessionCount: number;
  createdAt: string;
}

export const ALL = "all";

export interface LocationFilters {
  query: string;
  region: string;
  environment: string;
  kind: string;
}

export const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "alpha", label: "A–Z" },
  { value: "most", label: "Most photographed" },
  { value: "recent", label: "Recently added" },
] as const;
export type SortValue = (typeof SORTS)[number]["value"];

export const EMPTY_FILTERS: LocationFilters = { query: "", region: ALL, environment: ALL, kind: ALL };

function haystack(l: FilterableLocation): string {
  return [
    l.title, l.city, l.neighborhood ?? "", l.description, l.best_for, l.best_time, l.tip,
    regionLabel(l.region), ...l.tags, ...l.environments.map((e) => environmentLabel(e)),
    ...l.kinds.map(sessionKindLabel),
  ].join(" ").toLowerCase();
}

export function matchesFilters(l: FilterableLocation, f: LocationFilters): boolean {
  if (f.region !== ALL && l.region !== f.region) return false;
  if (f.environment !== ALL && !l.environments.includes(f.environment)) return false;
  if (f.kind !== ALL && !l.kinds.includes(f.kind)) return false;
  const q = f.query.trim().toLowerCase();
  return !q || q.split(/\s+/).every((word) => haystack(l).includes(word));
}

const byTitle = (a: FilterableLocation, b: FilterableLocation) => a.title.localeCompare(b.title);

export function sortLocations<T extends FilterableLocation>(items: readonly T[], sort: SortValue): T[] {
  const copy = [...items];
  switch (sort) {
    case "alpha": return copy.sort(byTitle);
    case "most": return copy.sort((a, b) => b.sessionCount - a.sessionCount || b.photoCount - a.photoCount || byTitle(a, b));
    case "recent": return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byTitle(a, b));
    default: return copy.sort((a, b) => a.order - b.order || byTitle(a, b));
  }
}

export function applyFilters<T extends FilterableLocation>(items: readonly T[], f: LocationFilters, sort: SortValue): T[] {
  return sortLocations(items.filter((l) => matchesFilters(l, f)), sort);
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/** Only options at least one location has — a filter never leads to an empty list on its own. */
function facet(
  list: readonly { value: string }[], label: (v: string) => string, count: (v: string) => number,
): FacetOption[] {
  return list.map((o) => ({ value: o.value, label: label(o.value), count: count(o.value) })).filter((o) => o.count > 0);
}

export function facetOptions(items: readonly FilterableLocation[]) {
  return {
    regions: facet(LIBRARY_REGIONS, (v) => regionLabel(v), (v) => items.filter((l) => l.region === v).length),
    environments: facet(ENVIRONMENTS, (v) => environmentLabel(v, true), (v) => items.filter((l) => l.environments.includes(v)).length),
    kinds: facet(SESSION_KINDS, sessionKindLabel, (v) => items.filter((l) => l.kinds.includes(v)).length),
  };
}

export function activeFilterCount(f: LocationFilters): number {
  return [f.region, f.environment, f.kind].filter((v) => v !== ALL).length + (f.query.trim() ? 1 : 0);
}
