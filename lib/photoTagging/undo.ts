// Undo for a tag apply. Pure — the admin client keeps the apply's outcomes and
// replays each updated field's previous value with Replace on.
//
// Only fields that were actually updated are undone. A session-wide value is
// restored once per session. Requests run in phases so each one plans against
// the facts it needs: spots first (clearing a spot needs the photo's school),
// then university / location, then category (a university only applies while
// the photo is still a graduation photo). A category is never cleared — a
// photo without one has nothing to restore.
import type { TagOutcome } from "@/lib/photoTagging/plan";
import type { TagChanges, TagField } from "@/lib/photoTagging/types";

export interface UndoRequest { keys: string[]; changes: TagChanges }

const PHASE: Record<TagField, number> = { spot: 0, school: 1, location: 1, category: 2 };

export function undoRequests(outcomes: readonly TagOutcome[]): UndoRequest[] {
  const perKey = new Map<string, { phase: number; changes: TagChanges }[]>();
  const sessionWrites = new Set<string>();
  for (const o of outcomes) {
    if (o.result !== "updated") continue;
    if (o.field === "category" && o.previous === null) continue;
    if (o.scope === "session" && o.writeId) {
      if (sessionWrites.has(o.writeId)) continue;
      sessionWrites.add(o.writeId);
    }
    const list = perKey.get(o.key) ?? [];
    const phase = PHASE[o.field];
    const slot = list.find((x) => x.phase === phase);
    const changes = { ...slot?.changes, [o.field]: o.previous } as TagChanges;
    perKey.set(o.key, [...list.filter((x) => x.phase !== phase), { phase, changes }]);
  }
  const groups = new Map<string, { phase: number; request: UndoRequest }>();
  for (const [key, list] of perKey) {
    for (const { phase, changes } of list) {
      const id = `${phase}|${JSON.stringify(Object.entries(changes).sort())}`;
      const prev = groups.get(id);
      groups.set(id, { phase, request: { keys: [...(prev?.request.keys ?? []), key], changes } });
    }
  }
  return [...groups.values()].sort((a, b) => a.phase - b.phase).map((g) => g.request);
}
