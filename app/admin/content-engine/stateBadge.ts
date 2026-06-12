// Derived-state badges + the spec §7.1 actionability sort:
// failed/interrupted → approved-waiting → drafts-for-review → in-progress →
// uploaded-not-analyzed → done. Colors come from the Darkroom theme (adminTheme).
import { T } from "@/app/admin/adminTheme";
import type { SessionEngineState } from "@/lib/contentEngine/state";

export const STATE_BADGES: Record<SessionEngineState, { label: string; color: string; bg: string }> = {
  failed:              { label: "Failed",            color: T.red,      bg: T.redBg },
  publishing:          { label: "Publishing…",       color: T.blue,     bg: T.blueBg },
  partially_published: { label: "Partly published",  color: T.amber,    bg: T.amberBg },
  published:           { label: "Published",         color: T.green,    bg: T.greenBg },
  reviewed:            { label: "Ready to publish",  color: T.violet,   bg: T.violetBg },
  generated:           { label: "Drafts ready",      color: T.amber,    bg: T.amberBg },
  analyzing:           { label: "Analyzing…",        color: T.blue,     bg: T.blueBg },
  analyzed:            { label: "Analyzed",          color: T.blue,     bg: T.blueBg },
  uploaded:            { label: "Uploaded",          color: T.inkSoft,  bg: T.neutralBg },
  empty:               { label: "Empty",             color: T.inkFaint, bg: T.neutralBg },
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
