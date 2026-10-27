// Dry run of a tag plan: what WOULD change, and how far a session-wide write
// reaches beyond the chosen photos. Pure — nothing is written. The admin sees
// this before confirming, so a university set on one Content Engine photo
// never silently retags the rest of its session.
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { summarize, type ApplyCounts } from "@/lib/photoTagging/apply";
import type { TagOutcome, TagPlan } from "@/lib/photoTagging/plan";

export interface SessionImpact {
  sessionId: string;
  sessionName: string | null;
  /** The session fact written ("school") and its new value (null = cleared). */
  field: "school";
  value: string | null;
  /** Photos NOT in the selection whose value comes from this session and so change too. */
  otherPhotos: number;
}

export interface PreviewResult extends Omit<ApplyCounts, "failed"> {
  outcomes: TagOutcome[];
  sessionImpact: SessionImpact[];
}

/** Other library photos that read their university from the session (no school of their own). */
function inheritors(all: readonly LibraryEntry[], sessionId: string, chosen: ReadonlySet<string>): number {
  return all.filter((e) => e.photo.sessionId === sessionId && !chosen.has(e.photo.key)
    && (e.target.source === "engine" || !e.target.stored?.school)).length;
}

export function previewPlan(plan: TagPlan, all: readonly LibraryEntry[], chosenKeys: readonly string[]): PreviewResult {
  const { updated, kept, skipped, conflicts, outcomes } = summarize(plan, new Map());
  const chosen = new Set(chosenKeys);
  const nameOf = (id: string) => all.find((e) => e.photo.sessionId === id)?.photo.sessionName ?? null;
  const sessionImpact = plan.writes.flatMap((w): SessionImpact[] => (w.kind === "session" && w.patch.school_slug !== undefined
    ? [{ sessionId: w.sessionId, sessionName: nameOf(w.sessionId), field: "school", value: w.patch.school_slug,
        otherPhotos: inheritors(all, w.sessionId, chosen) }]
    : []));
  return { updated, kept, skipped, conflicts, outcomes, sessionImpact };
}
