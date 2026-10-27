"use client";
// Review queue above a tagging grid: what to look at next, most important
// first (lib/photoTagging/reviewQueue.ts). Each row shows what accepting
// would change (before → after); choosing an answer is previewed when it
// reaches other photos. "Approve safe" applies only non-conflicting,
// high-confidence, photo-scoped answers — after a preview — and every
// write can be undone. Verified fields never appear here.
import { useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, chip } from "@/app/admin/content-engine/[id]/ui";
import {
  buildReviewQueue, QUEUE_LABELS, QUEUE_PRIORITY, safeKeys, type QueueItem, type QueueKind,
} from "@/lib/photoTagging/reviewQueue";
import type { AuditedPhoto, TaggingOptions, TagSuggestion } from "@/lib/photoTagging/types";
import TagApplyPanel, { valueLabel } from "./TagApplyPanel";
import { useTagApply, type TagApply } from "./useTagApply";

const COLLAPSED_ROWS = 6;
const small = { padding: "3px 10px", fontSize: 12 } as const;
const KINDS = (Object.keys(QUEUE_PRIORITY) as QueueKind[]).sort((a, b) => QUEUE_PRIORITY[a] - QUEUE_PRIORITY[b]);

interface Props {
  photos: readonly AuditedPhoto[];
  options: TaggingOptions;
  onChanged: () => Promise<void> | void;
  /** Opens the photo's tag editor (for items with no answer to pick). */
  onOpen?: (key: string) => void;
}

function Row({ item, options, apply, onOpen }: { item: QueueItem; options: TaggingOptions; apply: TagApply; onOpen?: (key: string) => void }) {
  const choose = (s: TagSuggestion) => void apply.submit({ kind: "changes", keys: [item.key], changes: { [s.field]: s.value }, replace: false });
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 8px", borderRadius: 10,
      background: T.inset, border: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.ink, fontWeight: 700, flex: "1 1 160px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.title}
      </span>
      <span style={{ fontSize: 12, color: T.inkSoft, flex: "2 1 220px" }}>
        {QUEUE_LABELS[item.kind]} · <span style={{ color: T.inkFaint }}>{valueLabel(item.field, item.before, options)}</span>
        {item.options.length === 1 ? <> → <strong style={{ color: T.ink }}>{item.options[0].label}</strong></> : null}
        {item.options.length === 0 ? " · no record answers it" : ""}
      </span>
      {item.options.map((s) => (
        <button key={s.id} type="button" style={{ ...btn(item.safe), ...small }} disabled={apply.busy} onClick={() => choose(s)}
          title={`${s.reason}${s.appliesTo === "session" ? " · sets the whole session" : ""}`}>
          {item.options.length > 1 ? s.label : "Accept"}{s.appliesTo === "session" ? " (session)" : ""}
        </button>
      ))}
      {onOpen && <button type="button" style={{ ...btn(false), ...small }} onClick={() => onOpen(item.key)}>Open</button>}
    </li>
  );
}

export default function ReviewQueue({ photos, options, onChanged, onOpen }: Props) {
  const items = useMemo(() => buildReviewQueue(photos), [photos]);
  const [kind, setKind] = useState<QueueKind | null>(null);
  const [expanded, setExpanded] = useState(false);
  const apply = useTagApply(onChanged);
  const shown = kind ? items.filter((i) => i.kind === kind) : items;
  const safe = safeKeys(shown);
  const titleOf = (key: string) => items.find((i) => i.key === key)?.title ?? key;
  if (items.length === 0 && !apply.toast) return null;
  return (
    <section style={{ ...card, marginBottom: 0, display: "grid", gap: 8 }} aria-label="Tagging review queue">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 14, color: T.ink, marginRight: 4 }}>Review queue · {items.length}</strong>
        {KINDS.map((k) => {
          const n = items.filter((i) => i.kind === k).length;
          return n === 0 ? null : (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}
              style={{ ...chip(kind === k ? T.amber : T.inkSoft, kind === k ? T.amberBg : "transparent"), cursor: "pointer", border: `1px solid ${T.border}` }}>
              {QUEUE_PRIORITY[k]}. {QUEUE_LABELS[k]} · {n}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        {safe.length > 0 && (
          <button type="button" style={{ ...btn(true), ...small }} disabled={apply.busy}
            title="Only answers with one high-confidence, non-conflicting value that affect this photo alone"
            onClick={() => void apply.submit({ kind: "high", keys: safe, photoOnly: true }, "always")}>
            Approve {safe.length} safe
          </button>
        )}
      </div>
      <TagApplyPanel apply={apply} options={options} titleOf={titleOf} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {(expanded ? shown : shown.slice(0, COLLAPSED_ROWS)).map((item) => (
          <Row key={item.id} item={item} options={options} apply={apply} onOpen={onOpen} />
        ))}
      </ul>
      {shown.length > COLLAPSED_ROWS && (
        <button type="button" style={{ ...btn(false), ...small, justifySelf: "start" }} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer" : `Show all ${shown.length}`}
        </button>
      )}
    </section>
  );
}
