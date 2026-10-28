"use client";
// Tagging status inside one Content Engine session's photo grid: the review
// queue, status filter chips, the tag editor for the photo whose badge was
// clicked (inline) or whose queue row's Edit was pressed (as a modal), and
// bulk tagging for the photos selected in the grid — opened from the
// selection toolbar's "Tag N selected" as a dialog, so it is reachable
// without scrolling past the queue. The bulk editor's preview, result and
// Undo live here (shared apply state), so they stay on the page after the
// dialog closes. A session photo that is also a portfolio row is audited
// once, as that portfolio photo.
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditedPhoto } from "@/lib/photoTagging/types";
import { selectedAudited, stillNeedsEditing } from "@/lib/photoTagging/gridSelection";
import BulkTagDialog from "@/app/admin/photoTagging/BulkTagDialog";
import PhotoTagDialog from "@/app/admin/photoTagging/PhotoTagDialog";
import PhotoTagEditor from "@/app/admin/photoTagging/PhotoTagEditor";
import PhotoTagToolbar from "@/app/admin/photoTagging/PhotoTagToolbar";
import ReviewQueue from "@/app/admin/photoTagging/ReviewQueue";
import TagApplyPanel from "@/app/admin/photoTagging/TagApplyPanel";
import { usePhotoTagging, type PhotoTagging } from "@/app/admin/photoTagging/usePhotoTagging";
import { useTagApply } from "@/app/admin/photoTagging/useTagApply";

export interface SessionTagging {
  tagging: PhotoTagging;
  sessionId: string;
  /** Audit entry for a session photo id. */
  byPhotoId: Map<string, AuditedPhoto>;
  /** Whether a session photo passes the tagging filter. */
  passes: (photoId: string) => boolean;
}

/** factsKey changes whenever the session's school / location / service change, so badges follow. */
export function useSessionTagging(sessionId: string, factsKey: string): SessionTagging {
  const tagging = usePhotoTagging({ sessionId });
  const { refresh, report, visible, filter } = tagging;
  const lastKey = useRef(factsKey);
  useEffect(() => {
    if (lastKey.current === factsKey) return;
    lastKey.current = factsKey;
    void refresh();
  }, [factsKey, refresh]);
  const byPhotoId = useMemo(() => new Map((report?.photos ?? []).flatMap((p) =>
    (p.enginePhotoId ? [[p.enginePhotoId, p] as const] : []))), [report]);
  const passes = useMemo(() => (photoId: string) => {
    const photo = byPhotoId.get(photoId);
    return photo ? visible(photo.key) : filter.filter === "all";
  }, [byPhotoId, visible, filter]);
  return { tagging, sessionId, byPhotoId, passes };
}

interface Props {
  state: SessionTagging;
  selectedIds: ReadonlySet<string>;
  /** Session photo ids in grid order (the bulk editor keeps that order). */
  gridOrder: readonly string[];
  openId: string | null;
  onClose: () => void;
  onClearSelection: () => void;
  /** The bulk editor dialog, opened from the selection toolbar. */
  bulkOpen: boolean;
  onBulkClose: () => void;
  /** Signed thumbnails by photo key, for private photos in the queue and the editor. */
  thumbs?: Record<string, string>;
}

/**
 * Bulk apply state for the grid selection. After a write the audit is
 * refreshed; once the fresh report shows every selected photo fully tagged,
 * the dialog closes and the selection clears, otherwise both stay.
 */
function useBulkApply(state: SessionTagging, selected: readonly AuditedPhoto[], onDone: () => void) {
  const { tagging, byPhotoId } = state;
  const wrote = useRef(false);
  const apply = useTagApply(async () => {
    wrote.current = true;
    await tagging.refresh();
  });
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    if (!wrote.current) return;
    wrote.current = false;
    const fresh = selectedRef.current.map((p) => (p.enginePhotoId && byPhotoId.get(p.enginePhotoId)) || p);
    if (fresh.length > 0 && !stillNeedsEditing(fresh)) onDone();
  // byPhotoId changes exactly when a refreshed report lands; onDone is stable enough for this.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byPhotoId]);
  return apply;
}

export default function PhotoTaggingPanel({
  state, selectedIds, gridOrder, openId, onClose, onClearSelection, bulkOpen, onBulkClose, thumbs = {},
}: Props) {
  const { tagging, byPhotoId, sessionId } = state;
  const { report } = tagging;
  const photos = useMemo(() => [...byPhotoId.values()], [byPhotoId]);
  const [queueKey, setQueueKey] = useState<string | null>(null);
  const selected = useMemo(() => selectedAudited(selectedIds, gridOrder, byPhotoId), [selectedIds, gridOrder, byPhotoId]);
  const finish = () => { onBulkClose(); onClearSelection(); };
  const bulkApply = useBulkApply(state, selected, finish);
  if (!report) return tagging.error ? <p style={{ fontSize: 12 }}>Tagging status unavailable: {tagging.error}</p> : null;
  const open = openId ? byPhotoId.get(openId) : undefined;
  const queueOpen = queueKey ? photos.find((p) => p.key === queueKey) : undefined;
  const titleOf = (key: string) => photos.find((p) => p.key === key)?.title ?? key;
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      {!bulkOpen && <TagApplyPanel apply={bulkApply} options={report.options} titleOf={titleOf} />}
      <PhotoTagToolbar photos={photos} options={report.options} filter={tagging.filter} setFilter={tagging.setFilter} compact />
      <ReviewQueue photos={photos} options={report.options} onChanged={tagging.refresh} sessionId={sessionId}
        onOpen={setQueueKey} thumbs={thumbs} />
      {queueOpen && (
        <PhotoTagDialog photo={queueOpen} options={report.options} thumb={thumbs[queueOpen.key]}
          onChanged={tagging.refresh} onClose={() => setQueueKey(null)} />
      )}
      {open && <PhotoTagEditor photo={open} options={report.options} thumb={thumbs[open.key]} onChanged={tagging.refresh} onClose={onClose} />}
      {bulkOpen && selected.length > 0 && (
        <BulkTagDialog photos={selected} options={report.options} apply={bulkApply} onChanged={tagging.refresh}
          onClose={onBulkClose} onClearSelection={finish} />
      )}
    </div>
  );
}
