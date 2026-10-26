"use client";
// Tagging filters for a photo grid: status / missing-field chips with live
// counts, plus category and university filters. Counts come from the same
// predicates as the filter itself (lib/photoTagging/filters.ts).
import { useMemo } from "react";
import { T } from "@/app/admin/adminTheme";
import { input } from "@/app/admin/content-engine/[id]/ui";
import { countTags, filterCount } from "@/lib/photoTagging/filters";
import {
  categoryLabel, FILTER_LABELS, TAG_FILTERS,
  type AuditedPhoto, type TagFilter, type TagFilterState, type TaggingOptions,
} from "@/lib/photoTagging/types";
import { STATUS_TONE } from "./TagStatusBadge";

interface Props {
  photos: readonly AuditedPhoto[];
  options: TaggingOptions | null;
  filter: TagFilterState;
  setFilter: (next: TagFilterState) => void;
  /** Hide the category / university selects (a single session has one of each). */
  compact?: boolean;
}

function chipTone(f: TagFilter) {
  if (f === "full" || f === "partial" || f === "needs") return STATUS_TONE[f];
  return { color: T.inkSoft, bg: T.inset, border: T.border };
}

export default function PhotoTagToolbar({ photos, options, filter, setFilter, compact = false }: Props) {
  const counts = useMemo(() => countTags(photos), [photos]);
  const categories = useMemo(() => [...new Set(photos.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [photos]);
  const attention = counts.partial + counts.needs;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700, marginRight: 4 }}>
          Photo tagging · {attention} need attention
        </span>
        {TAG_FILTERS.map((f) => {
          const active = filter.filter === f;
          const tone = chipTone(f);
          return (
            <button key={f} type="button" aria-pressed={active} onClick={() => setFilter({ ...filter, filter: f })}
              style={{
                borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${active ? tone.color : tone.border}`,
                background: active ? tone.bg : "transparent", color: active ? tone.color : T.inkSoft,
              }}>
              {FILTER_LABELS[f]} · {filterCount(counts, f)}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select aria-label="Filter by category" style={{ ...input, width: "auto" }} value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <select aria-label="Filter by university" style={{ ...input, width: "auto" }} value={filter.school}
            onChange={(e) => setFilter({ ...filter, school: e.target.value })}>
            <option value="">All universities</option>
            <option value="none">Graduation · no university</option>
            {(options?.schools ?? []).map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
