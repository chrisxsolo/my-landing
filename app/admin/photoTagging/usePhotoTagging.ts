"use client";
// State for the tagging audit in any photo grid: the audited photos, the
// active filter, and a multi-select for bulk tagging. Filtering is local
// (lib/photoTagging/filters.ts), so changing a filter never refetches.
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_TAG_FILTER, matchesFilterState } from "@/lib/photoTagging/filters";
import type { AuditedPhoto, TagFilterState, TaggingReport } from "@/lib/photoTagging/types";
import { taggingApi } from "./taggingApi";

export interface PhotoTagging {
  report: TaggingReport | null;
  byKey: Map<string, AuditedPhoto>;
  loading: boolean;
  error: string | null;
  filter: TagFilterState;
  setFilter: (next: TagFilterState) => void;
  /** Whether a photo passes the active filter (unknown photos pass only "all"). */
  visible: (key: string) => boolean;
  selected: ReadonlySet<string>;
  toggle: (key: string) => void;
  selectMany: (keys: string[]) => void;
  clearSelection: () => void;
  refresh: () => Promise<void>;
}

interface Options {
  sessionId?: string;
  initialFilter?: Partial<TagFilterState>;
  /** Load only once enabled (e.g. when its admin tab opens). Default true. */
  enabled?: boolean;
}

export function usePhotoTagging(opts: Options = {}): PhotoTagging {
  const { sessionId, enabled = true } = opts;
  const [report, setReport] = useState<TaggingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TagFilterState>({ ...DEFAULT_TAG_FILTER, ...opts.initialFilter });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      setReport(await taggingApi.load(sessionId));
      setError(null);
    } catch (err) {
      console.error("[photo-tagging] load failed", err);
      setError(err instanceof Error ? err.message : "could not load tagging status");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const loaded = report !== null;
  useEffect(() => {
    if (enabled && !loaded) void refresh();
  }, [enabled, loaded, refresh]);

  const byKey = useMemo(() => new Map((report?.photos ?? []).map((p) => [p.key, p])), [report]);

  const visible = useCallback((key: string) => {
    const photo = byKey.get(key);
    if (!photo) return filter.filter === "all" && !filter.category && !filter.school;
    return matchesFilterState(photo, filter);
  }, [byKey, filter]);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const selectMany = useCallback((keys: string[]) => setSelected(new Set(keys)), []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  return { report, byKey, loading, error, filter, setFilter, visible, selected, toggle, selectMany, clearSelection, refresh };
}
