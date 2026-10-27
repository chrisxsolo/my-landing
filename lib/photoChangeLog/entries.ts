// What goes into photo_change_log, built from the tagging plan's outcomes and
// from the location sync's link changes. Pure — client-safe (the history UI
// reads these shapes).
import type { TagOutcome } from "@/lib/photoTagging/plan";
import type { TagField } from "@/lib/photoTagging/types";

export const PHOTO_CHANGE_LOG_TABLE = "photo_change_log";

/** manual = a person, through the admin · system = an automated step on records · ai = an AI-authored write. */
export type ChangeActor = "ai" | "system" | "manual";
export const CHANGE_ACTORS: readonly ChangeActor[] = ["ai", "system", "manual"];

/** Session-level fields the sync logs under a "session:<uuid>" key. */
export const LIBRARY_LINKS_FIELD = "library_links";

export const RESTORABLE_FIELDS: readonly string[] = ["category", "school", "location", "spot"] satisfies TagField[];

export interface ChangeEntry {
  key: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  actor: ChangeActor;
  reason: string | null;
}

export interface ChangeLogRow extends ChangeEntry {
  id: number;
  createdAt: string;
}

export const sessionKey = (sessionId: string) => `session:${sessionId}`;

export function isChangeActor(value: unknown): value is ChangeActor {
  return typeof value === "string" && (CHANGE_ACTORS as readonly string[]).includes(value);
}

/**
 * One entry per updated field. A session-wide value (a university on a
 * Content Engine session) is written once, under the session's key, not once
 * per photo that inherits it.
 */
export function entriesFromOutcomes(outcomes: readonly TagOutcome[], actor: ChangeActor, reason: string | null): ChangeEntry[] {
  const seen = new Set<string>();
  return outcomes.flatMap((o): ChangeEntry[] => {
    if (o.result !== "updated") return [];
    const key = o.scope === "session" && o.writeId ? o.writeId : o.key;
    const id = `${key}:${o.field}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ key, field: o.field, oldValue: o.previous, newValue: o.value, actor, reason }];
  });
}

/** The sync's change to a session's library links, or null when nothing changed. */
export function linkChangeEntry(
  sessionId: string, before: readonly number[], after: readonly number[], reason: string,
): ChangeEntry | null {
  const sort = (ids: readonly number[]) => [...new Set(ids)].sort((a, b) => a - b);
  const prev = sort(before);
  const next = sort(after);
  if (prev.length === next.length && prev.every((id, i) => id === next[i])) return null;
  return {
    key: sessionKey(sessionId), field: LIBRARY_LINKS_FIELD,
    oldValue: { locationIds: prev }, newValue: { locationIds: next }, actor: "system", reason: reason.slice(0, 500),
  };
}

/** Whether a history row can be put back through the tagging apply path. */
export function isRestorable(row: Pick<ChangeLogRow, "field" | "oldValue">): boolean {
  return RESTORABLE_FIELDS.includes(row.field) && (row.oldValue === null || typeof row.oldValue === "string");
}
