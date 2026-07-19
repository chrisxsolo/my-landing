// Permanent deletion of uploaded session photos (admin trims an over-large
// upload). Photos with a live public derivative are skipped — they're on the
// public site and must go through takedown first. DB rows are deleted before
// storage objects: a leaked original is invisible, but a row whose original is
// gone breaks thumbnails and re-analysis.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";

export const MAX_DELETE_BATCH = 300;

export interface DeletePhotosResult {
  deleted: string[];
  skippedPublished: string[];
}

export async function deleteSessionPhotos(
  client: SupabaseClient,
  sessionId: string,
  photoIds: string[],
): Promise<DeletePhotosResult> {
  const ids = [...new Set(photoIds.map((id) => id.toLowerCase()))];
  if (ids.length === 0) return { deleted: [], skippedPublished: [] };

  // Session filter makes ids from other sessions no-ops rather than deletions.
  const { data: photos, error } = await client
    .from("session_photos")
    .select("id,storage_path,public_derivative_url")
    .eq("photography_session_id", sessionId.toLowerCase())
    .in("id", ids);
  if (error) throw new Error(`could not load photos: ${error.message}`);

  const skippedPublished = (photos ?? [])
    .filter((p) => p.public_derivative_url !== null)
    .map((p) => p.id as string);
  const deletable = (photos ?? []).filter((p) => p.public_derivative_url === null);
  if (deletable.length === 0) return { deleted: [], skippedPublished };

  const { error: delErr } = await client
    .from("session_photos")
    .delete()
    .in("id", deletable.map((p) => p.id as string));
  if (delErr) throw new Error(`could not delete photos: ${delErr.message}`);

  const { error: rmErr } = await client.storage
    .from(ORIGINALS_BUCKET)
    .remove(deletable.map((p) => p.storage_path as string));
  if (rmErr) console.error("original removal failed after row delete:", rmErr.message);

  return { deleted: deletable.map((p) => p.id as string), skippedPublished };
}
