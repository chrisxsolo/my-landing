"use client";
// Review queue above a tagging grid: what to look at next, most important
// first. Photo items come from the live audit (lib/photoTagging/reviewQueue);
// the rest — excluded photos still live, sessions and places needing review
// — from /api/admin/review-queue (lib/reviewQueue). Every approval is
// previewed when it reaches other photos, every tag write can be undone, and
// the durable history (photo_change_log) is one click away. "Approve safe"
// applies only non-conflicting, high-confidence, photo-scoped answers that
// rest on records — never AI vision. Verified fields never appear here.
// Photo cards can be selected (by card id) for batch editing: one preview and
// one confirmation for a shared answer, or the bulk editor for the rest. The
// selection lives within the current filter and follows the queue — cards
// that get approved, dismissed or filtered out leave it on their own.
import { useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card } from "@/app/admin/content-engine/[id]/ui";
import { isBatchEditable, pruneSelection, selectedItems, suggestionChanges, uniqueKeys } from "@/lib/photoTagging/batchSelection";
import {
  buildReviewQueue, EMPTY_QUEUE_FILTER, filterQueue, safeKeys, sortByNewest, sortByPriority,
  type QueueAction, type QueueFilter, type QueueItem,
} from "@/lib/photoTagging/reviewQueue";
import type { AuditedPhoto, TaggingOptions, TagSuggestion } from "@/lib/photoTagging/types";
import { findingItems } from "@/lib/reviewQueue/findingItems";
import ChangeHistory from "./ChangeHistory";
import ReviewBatchPanel from "./ReviewBatchPanel";
import ReviewQueueFilters, { type QueueSort } from "./ReviewQueueFilters";
import ReviewQueueRow, { TOUCH, type RowHandlers } from "./ReviewQueueRow";
import { reviewQueueApi } from "./reviewQueueApi";
import TagApplyPanel from "./TagApplyPanel";
import { taggingApi } from "./taggingApi";
import { useReviewFindings } from "./useReviewFindings";
import { useTagApply } from "./useTagApply";

const COLLAPSED_ROWS = 6;
const NONE: ReadonlySet<string> = new Set();

interface Props {
  photos: readonly AuditedPhoto[];
  options: TaggingOptions;
  onChanged: () => Promise<void> | void;
  /** Opens the photo's tag editor (for items with no answer to pick). */
  onOpen?: (key: string) => void;
  /** Limits the server findings to one Content Engine session. */
  sessionId?: string;
  /** Signed thumbnails for private photos, by photo key. */
  thumbs?: Record<string, string>;
}

/** Accepting a suggestion records what it rested on; a session-wide value always asks first. */
function acceptRequest(item: QueueItem, s: TagSuggestion) {
  return { request: { kind: "changes" as const, keys: [item.key], changes: suggestionChanges(s), replace: false },
    mode: s.appliesTo === "session" ? "always" as const : "when-wide" as const };
}

/** Card selection by queue-item id, scoped to the shown cards and pruned as they leave. */
function useCardSelection(shown: readonly QueueItem[]) {
  const [stored, setSelected] = useState<ReadonlySet<string>>(NONE);
  // Cards that left the shown queue leave the selection in the same render (pruneSelection returns the same set when nothing changed).
  const selected = pruneSelection(stored, shown);
  if (selected !== stored) setSelected(selected);
  const toggle = (item: QueueItem) => setSelected((prev) => {
    const next = new Set(prev);
    if (!next.delete(item.id)) next.add(item.id);
    return next;
  });
  const selectAll = (items: readonly QueueItem[]) => setSelected(new Set(items.filter(isBatchEditable).map((i) => i.id)));
  const clear = () => setSelected(NONE);
  return { selected, toggle, selectAll, clear };
}

export default function ReviewQueue({ photos, options, onChanged, onOpen, sessionId, thumbs = {} }: Props) {
  const findings = useReviewFindings(sessionId);
  const [filter, setFilterState] = useState<QueueFilter>(EMPTY_QUEUE_FILTER);
  const [sort, setSort] = useState<QueueSort>("priority");
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const refreshAll = async () => { await Promise.all([onChanged(), findings.refresh()]); };
  const apply = useTagApply(refreshAll);

  const items = useMemo(() => {
    const all = [...buildReviewQueue(photos), ...(findings.findings ? findingItems(findings.findings) : [])];
    return sort === "newest" ? sortByNewest(all) : sortByPriority(all);
  }, [photos, findings.findings, sort]);
  const shown = useMemo(() => filterQueue(items, filter), [items, filter]);
  const rendered = expanded ? shown : shown.slice(0, COLLAPSED_ROWS);
  const safe = safeKeys(shown);
  const titleOf = (key: string) => items.find((i) => i.key === key)?.title ?? key;

  const selection = useCardSelection(shown);
  const setFilter = (next: QueueFilter) => { setFilterState(next); selection.clear(); };
  const picked = selectedItems(shown, selection.selected);
  const pickedPhotos = uniqueKeys(picked).flatMap((key) => photos.filter((p) => p.key === key));
  const selectable = rendered.filter(isBatchEditable);

  const handlers: RowHandlers = {
    busy: apply.busy,
    onOpen,
    onAccept: (item, s) => { const { request, mode } = acceptRequest(item, s); void apply.submit(request, mode); },
    onReject: (item) => void apply.run(async () => {
      const ids = item.kind === "excluded-live" ? item.actions.map((a) => `placement:${a.id}`) : item.options.map((s) => s.id);
      for (const id of ids) await taggingApi.dismiss(item.key, id);
      return item.kind === "excluded-live" ? "Kept live — this photo will not be asked about again." : `Dismissed ${ids.length} suggestion(s).`;
    }),
    onAction: (item, action: QueueAction) => void apply.run(async () => {
      if (!action.request) return "Nothing to do.";
      if (action.confirm && !window.confirm(action.confirm)) return "Cancelled.";
      await reviewQueueApi.run(action.request);
      return `${action.label}: done (${item.title}).`;
    }),
  };

  if (items.length === 0 && !apply.toast && !findings.error) return null;
  return (
    <section style={{ ...card, marginBottom: 0, display: "grid", gap: 10 }} aria-label="Review queue">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 14, color: T.ink }}>Review queue · {items.length}</strong>
        <span style={{ flex: 1 }} />
        {safe.length > 0 && (
          <button type="button" style={{ ...btn(true), ...TOUCH }} disabled={apply.busy}
            title="Only answers with one high-confidence, non-conflicting value from records that affect this photo alone"
            onClick={() => void apply.submit({ kind: "high", keys: safe, photoOnly: true }, "always")}>
            Approve {safe.length} safe
          </button>
        )}
        <button type="button" style={{ ...btn(false), ...TOUCH }} aria-pressed={showHistory} onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Hide history" : "History"}
        </button>
      </div>
      {findings.error && <p style={{ margin: 0, fontSize: 12, color: T.red }}>Some findings could not be loaded: {findings.error}</p>}
      {findings.findings?.errors.length ? <p style={{ margin: 0, fontSize: 12, color: T.red }}>Findings incomplete: {findings.findings.errors.join("; ")}</p> : null}
      <ReviewQueueFilters items={items} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} />
      {selectable.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={{ ...btn(false), ...TOUCH }} onClick={() => selection.selectAll(selectable)}
            disabled={picked.length === selectable.length}
            title="Selects only the photo cards shown right now — never hidden or filtered-out cards">
            Select all shown ({selectable.length})
          </button>
        </div>
      )}
      {picked.length > 0 && (
        <ReviewBatchPanel items={picked} photos={pickedPhotos} options={options} apply={apply} onChanged={refreshAll} onClear={selection.clear} />
      )}
      <TagApplyPanel apply={apply} options={options} titleOf={titleOf} />
      {showHistory && <ChangeHistory options={options} titleOf={titleOf} onChanged={refreshAll} />}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {rendered.map((item) => (
          <ReviewQueueRow key={item.id} item={item} options={options} thumbs={thumbs} h={handlers}
            selection={isBatchEditable(item) ? { selected: selection.selected.has(item.id), onToggle: selection.toggle } : undefined} />
        ))}
      </ul>
      {shown.length > COLLAPSED_ROWS && (
        <button type="button" style={{ ...btn(false), ...TOUCH, justifySelf: "start" }} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer" : `Show all ${shown.length}`}
        </button>
      )}
    </section>
  );
}
