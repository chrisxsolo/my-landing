// Multi-select in a session's photo grid, as it feeds the batch tag editor.
// Pure — the Content Engine session page (PhotosSection / PhotoTaggingPanel)
// reads these so the toolbar, the editor and the tests agree on one rule set.
//
//   · a selection is a set of session photo ids; the editor receives the
//     audited photos behind them, each once, in grid order — ids that are not
//     in the audit (excluded photos, a photo the audit has not loaded yet)
//     drop out rather than reaching the editor
//   · after a successful write the editor stays open only while a selected
//     photo still needs editing; once every selected photo is fully tagged
//     the editor closes and the selection clears, so a finished batch never
//     lingers and an unfinished one never loses its place
import type { AuditedPhoto } from "@/lib/photoTagging/types";

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The toolbar's words for a selection of n photos. */
export function selectionLabels(n: number) {
  return {
    count: `${n} selected`,
    tag: `Tag ${n} selected`,
    remove: `Delete ${plural(n, "photo")}`,
  };
}

/** The audited photos behind the selected ids, once each, in the grid's order. */
export function selectedAudited(
  selectedIds: ReadonlySet<string>, gridOrder: readonly string[], byPhotoId: ReadonlyMap<string, AuditedPhoto>,
): AuditedPhoto[] {
  const seen = new Set<string>();
  return gridOrder.flatMap((id) => {
    if (!selectedIds.has(id) || seen.has(id)) return [];
    seen.add(id);
    const photo = byPhotoId.get(id);
    return photo ? [photo] : [];
  });
}

/** Whether the batch editor should stay open after a write: yes while any selected photo is not fully tagged. */
export function stillNeedsEditing(photos: readonly AuditedPhoto[]): boolean {
  return photos.some((p) => p.status !== "full");
}
