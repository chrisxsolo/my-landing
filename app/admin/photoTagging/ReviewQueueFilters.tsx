"use client";
// Filters and sort for the review queue: issue type chips (with counts), a
// session and a school picker built from the items present, and
// newest / priority order. Every control is at least 44px tall for touch.
import { T } from "@/app/admin/adminTheme";
import { chip, input } from "@/app/admin/content-engine/[id]/ui";
import {
  QUEUE_LABELS, QUEUE_PRIORITY, type QueueFilter, type QueueItem, type QueueKind,
} from "@/lib/photoTagging/reviewQueue";
import { schoolFilterLabel } from "@/lib/reviewQueue/findingItems";

export type QueueSort = "priority" | "newest";

const KINDS = (Object.keys(QUEUE_PRIORITY) as QueueKind[]).sort((a, b) => QUEUE_PRIORITY[a] - QUEUE_PRIORITY[b]);
const TOUCH = { minHeight: 44, cursor: "pointer", border: `1px solid ${T.border}`, padding: "0 12px", display: "inline-flex", alignItems: "center" } as const;
const SELECT = { ...input, minHeight: 44, width: "auto", maxWidth: "100%", fontSize: 13 } as const;

interface Props {
  items: readonly QueueItem[];
  filter: QueueFilter;
  setFilter: (next: QueueFilter) => void;
  sort: QueueSort;
  setSort: (next: QueueSort) => void;
}

function distinct<K extends string>(pairs: readonly (readonly [K, string])[]): [K, string][] {
  const map = new Map<K, string>();
  for (const [k, label] of pairs) if (!map.has(k)) map.set(k, label);
  return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

export default function ReviewQueueFilters({ items, filter, setFilter, sort, setSort }: Props) {
  const sessions = distinct(items.flatMap((i) => (i.sessionId ? [[i.sessionId, i.sessionName ?? i.title] as const] : [])));
  const schools = distinct(items.flatMap((i) => (i.school ? [[i.school, schoolFilterLabel(i.school)] as const] : [])));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {KINDS.map((k) => {
          const n = items.filter((i) => i.kind === k).length;
          if (n === 0) return null;
          const on = filter.kind === k;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => setFilter({ ...filter, kind: on ? null : k })}
              style={{ ...chip(on ? T.amber : T.inkSoft, on ? T.amberBg : "transparent"), ...TOUCH }}>
              {QUEUE_PRIORITY[k]}. {QUEUE_LABELS[k]} · {n}
            </button>
          );
        })}
      </div>
      {(sessions.length > 1 || schools.length > 1 || items.some((i) => i.createdAt)) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {sessions.length > 1 && (
            <select aria-label="Filter by session" style={SELECT} value={filter.sessionId ?? ""}
              onChange={(e) => setFilter({ ...filter, sessionId: e.target.value || null })}>
              <option value="">Every session</option>
              {sessions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          {schools.length > 1 && (
            <select aria-label="Filter by school" style={SELECT} value={filter.school ?? ""}
              onChange={(e) => setFilter({ ...filter, school: e.target.value || null })}>
              <option value="">Every school</option>
              {schools.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            </select>
          )}
          <select aria-label="Sort" style={SELECT} value={sort} onChange={(e) => setSort(e.target.value as QueueSort)}>
            <option value="priority">Most important first</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      )}
    </div>
  );
}
