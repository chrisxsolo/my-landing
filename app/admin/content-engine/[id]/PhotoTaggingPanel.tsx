"use client";
// Tagging status inside one Content Engine session's photo grid: status
// filter chips, the tag editor for the photo whose badge was clicked, and
// bulk tagging for the photos selected in the grid. A session photo that is
// also a portfolio row is audited once, as that portfolio photo.
import { useEffect, useMemo, useRef } from "react";
import type { AuditedPhoto } from "@/lib/photoTagging/types";
import BulkTagBar from "@/app/admin/photoTagging/BulkTagBar";
import PhotoTagEditor from "@/app/admin/photoTagging/PhotoTagEditor";
import PhotoTagToolbar from "@/app/admin/photoTagging/PhotoTagToolbar";
import ReviewQueue from "@/app/admin/photoTagging/ReviewQueue";
import { usePhotoTagging, type PhotoTagging } from "@/app/admin/photoTagging/usePhotoTagging";

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
  openId: string | null;
  onClose: () => void;
  onClearSelection: () => void;
}

export default function PhotoTaggingPanel({ state, selectedIds, openId, onClose, onClearSelection }: Props) {
  const { tagging, byPhotoId, sessionId } = state;
  const { report } = tagging;
  const photos = useMemo(() => [...byPhotoId.values()], [byPhotoId]);
  if (!report) return tagging.error ? <p style={{ fontSize: 12 }}>Tagging status unavailable: {tagging.error}</p> : null;
  const open = openId ? byPhotoId.get(openId) : undefined;
  const selected = [...selectedIds].map((id) => byPhotoId.get(id)).filter((p): p is AuditedPhoto => Boolean(p));
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <PhotoTagToolbar photos={photos} options={report.options} filter={tagging.filter} setFilter={tagging.setFilter} compact />
      <ReviewQueue photos={photos} options={report.options} onChanged={tagging.refresh} sessionId={sessionId} />
      {open && <PhotoTagEditor photo={open} options={report.options} onChanged={tagging.refresh} onClose={onClose} />}
      {selected.length > 0 && (
        <BulkTagBar photos={selected} options={report.options} onChanged={tagging.refresh} onClear={onClearSelection} />
      )}
    </div>
  );
}
