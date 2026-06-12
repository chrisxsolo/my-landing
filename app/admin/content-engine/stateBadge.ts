// Derived-state badges + the spec §7.1 actionability sort:
// failed/interrupted → approved-waiting → drafts-for-review → in-progress →
// uploaded-not-analyzed → done.
import { C } from "@/lib/colors";
import type { SessionEngineState } from "@/lib/contentEngine/state";



export const STATE_BADGES: Record<SessionEngineState, { label: string; color: string; bg: string }> = {
  failed:              { label: "Failed",            color: C.danger,   bg: C.dangerBg },
  publishing:          { label: "Publishing…",       color: C.ink,      bg: C.pageAlt },
  partially_published: { label: "Partly published",  color: C.ink,      bg: C.pageAlt },
  published:           { label: "Published",         color: C.muted,    bg: C.page },
  reviewed:            { label: "Reviewed",          color: C.ink,      bg: C.pageAlt },
  generated:           { label: "Drafts ready",      color: C.ink,      bg: C.pageAlt },
  analyzing:           { label: "Analyzing…",        color: C.ink,      bg: C.pageAlt },
  analyzed:            { label: "Analyzed",          color: C.ink,      bg: C.pageAlt },
  uploaded:            { label: "Uploaded",          color: C.ink,      bg: C.pageAlt },
  empty:               { label: "Empty",             color: C.muted,    bg: C.page },
};

const RANK: Record<SessionEngineState, number> = {
  failed: 0, publishing: 1, reviewed: 2, generated: 3,
  partially_published: 4, analyzing: 5, analyzed: 6, uploaded: 7,
  published: 8, empty: 9,
};

export function actionabilityRank(state: SessionEngineState): number {
  return RANK[state];
}

export function sortByActionability<T extends { state: SessionEngineState }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => actionabilityRank(a.state) - actionabilityRank(b.state));
}
