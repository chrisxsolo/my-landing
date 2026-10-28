// Draft journal photo membership + cover (pure, no I/O). The editor's tiles
// call these with the current payload and get back the next valid
// photo_ids / cover_photo_id pair in ONE step, so the autosaved payload never
// passes through a state where the cover is not one of the photos
// (journalPostPayloadSchema refuses that) or the journal has no photo at all.

export interface JournalPhotoSelection {
  photo_ids: string[];
  cover_photo_id: string;
}

export type SelectionRefusal =
  /** The id has no session photo any more, so it can never be the cover. */
  | "missing_photo"
  /** Removing it would leave the journal without a photo to be the cover. */
  | "last_photo";

export type SelectionResult =
  | { ok: true; selection: JournalPhotoSelection }
  | { ok: false; reason: SelectionRefusal };

const unique = (ids: string[]) => [...new Set(ids)];

/** Why a selection change was refused, in words the editor can show. */
export function refusalMessage(reason: SelectionRefusal, filename: string): string {
  return reason === "missing_photo"
    ? `${filename} no longer exists in this session, so it cannot be the cover.`
    : `${filename} is the only photo in this journal. Choose another cover before removing it.`;
}

/**
 * `id` becomes the cover. A photo that is not included yet is added (at the
 * end, so the existing gallery order is kept) in the same step; everything
 * else in the selection stays as it was. Choosing the current cover again is
 * a no-op. `existing` are the ids that still have a session photo.
 */
export function chooseCover(
  current: JournalPhotoSelection,
  id: string,
  existing: ReadonlySet<string>,
): SelectionResult {
  if (!existing.has(id)) return { ok: false, reason: "missing_photo" };
  const ids = unique(current.photo_ids);
  return {
    ok: true,
    selection: {
      photo_ids: ids.includes(id) ? ids : [...ids, id],
      cover_photo_id: id,
    },
  };
}

/**
 * Adds `id` to the journal, or removes it when it is already included. When
 * the cover is removed, the first remaining photo that still exists is
 * promoted; removing the only photo that could be the cover is refused.
 */
export function toggleInclusion(
  current: JournalPhotoSelection,
  id: string,
  existing: ReadonlySet<string>,
): SelectionResult {
  const ids = unique(current.photo_ids);
  if (!ids.includes(id)) {
    const cover = current.cover_photo_id || id;
    return { ok: true, selection: { photo_ids: [...ids, id], cover_photo_id: cover } };
  }
  const remaining = ids.filter((p) => p !== id);
  if (id !== current.cover_photo_id) {
    return { ok: true, selection: { photo_ids: remaining, cover_photo_id: current.cover_photo_id } };
  }
  const promoted = remaining.find((p) => existing.has(p));
  if (!promoted) return { ok: false, reason: "last_photo" };
  return { ok: true, selection: { photo_ids: remaining, cover_photo_id: promoted } };
}
