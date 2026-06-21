// Publish Step A (spec §4.3, §9.1): build the public, content-addressed
// derivative for every photo an approved item references. Photo ids come ONLY
// from the item's validated payload; ownership is verified; sharp strips all
// metadata (EXIF/GPS) by default. Content-addressed paths make retries exact
// and idempotent; an A-succeeded/B-failed gap leaves only an unreferenced file.
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORIGINALS_BUCKET, MAX_IMAGE_PIXELS } from "@/lib/contentEngine/uploadConfig";
import { validatePayload } from "@/lib/contentEngine/payloads";

export const PUBLIC_DERIVATIVES_BUCKET = "grad-photos"; // existing public bucket (spec §4.1)
export const MAX_DERIVATIVE_DIMENSION = 2400;
export const DERIVATIVE_JPEG_QUALITY = 82;

export type DerivativeErrorKind =
  | "not_found" | "not_approved" | "permission" | "payload"
  | "foreign_photo" | "source_missing" | "storage";

export class DerivativeError extends Error {
  readonly kind: DerivativeErrorKind;
  constructor(message: string, kind: DerivativeErrorKind) {
    super(message);
    this.name = "DerivativeError";
    this.kind = kind;
  }
}

// Photo ids referenced by a payload, deduplicated, per content type. Photo-less
// types return [] (they need no derivatives).
export function photoIdsFromPayload(contentType: string, payload: Record<string, unknown>): string[] {
  switch (contentType) {
    case "journal_post": {
      const ids = Array.isArray(payload.photo_ids) ? (payload.photo_ids as string[]) : [];
      const cover = typeof payload.cover_photo_id === "string" ? [payload.cover_photo_id] : [];
      return [...new Set([...ids, ...cover])];
    }
    case "portfolio_pick":
    case "school_page_photo":
    case "guide_photo":
      return typeof payload.session_photo_id === "string" ? [payload.session_photo_id] : [];
    default:
      return [];
  }
}

export interface DerivativeResult {
  photoId: string;
  url: string;
  storagePath: string;
  reused: boolean;
}

interface PhotoRow {
  id: string;
  photography_session_id: string;
  storage_path: string;
  content_hash: string;
  public_derivative_url: string | null;
  public_derivative_content_hash: string | null;
}

export function derivativeStoragePath(sessionId: string, photoId: string, contentHash: string): string {
  return `engine/${sessionId}/${photoId}/${contentHash}.jpg`;
}

async function buildDerivative(client: SupabaseClient, sessionId: string, photo: PhotoRow): Promise<DerivativeResult> {
  const { data: blob, error: dlErr } = await client.storage.from(ORIGINALS_BUCKET).download(photo.storage_path);
  if (dlErr || !blob) {
    throw new DerivativeError(`source object missing for photo ${photo.id}: ${dlErr?.message ?? "missing"}`, "source_missing");
  }
  const derivative = await sharp(Buffer.from(await blob.arrayBuffer()), { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate() // EXIF-orient (spec §4.3)
    .resize({ width: MAX_DERIVATIVE_DIMENSION, height: MAX_DERIVATIVE_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: DERIVATIVE_JPEG_QUALITY }) // metadata (EXIF/GPS) stripped by default
    .toBuffer();

  const storagePath = derivativeStoragePath(sessionId, photo.id, photo.content_hash);
  const { error: upErr } = await client.storage.from(PUBLIC_DERIVATIVES_BUCKET)
    .upload(storagePath, derivative, { contentType: "image/jpeg", upsert: true }); // content-addressed: retries are exact
  if (upErr) throw new DerivativeError(`derivative upload failed for photo ${photo.id}: ${upErr.message}`, "storage");

  const url = client.storage.from(PUBLIC_DERIVATIVES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const { error: recErr } = await client.from("session_photos").update({
    public_derivative_url: url,
    public_derivative_storage_path: storagePath,
    public_derivative_content_hash: photo.content_hash,
    public_derivative_created_at: new Date().toISOString(),
  }).eq("id", photo.id);
  if (recErr) throw new DerivativeError(`could not record derivative for photo ${photo.id}: ${recErr.message}`, "storage");

  return { photoId: photo.id, url, storagePath, reused: false };
}

async function mapWithConcurrency<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Build (or reuse) public derivatives for an explicit set of session photos —
// used when amending an already-published post (the publish path uses
// prepareApprovedDerivatives, which derives ids from a single item's payload).
// Reuse logic mirrors prepareApprovedDerivatives: a fresh content-addressed
// derivative is skipped when the recorded hash still matches the source.
export async function ensureDerivativesForPhotos(
  client: SupabaseClient, sessionId: string, photoIds: string[],
): Promise<DerivativeResult[]> {
  const ids = [...new Set(photoIds)];
  if (ids.length === 0) return [];

  const { data: photos, error } = await client.from("session_photos")
    .select("id,photography_session_id,storage_path,content_hash,public_derivative_url,public_derivative_content_hash")
    .in("id", ids);
  if (error) throw new DerivativeError(`could not load photos: ${error.message}`, "storage");
  const byId = new Map((photos ?? []).map((p) => [p.id as string, p as PhotoRow]));

  return mapWithConcurrency(ids, 4, async (id) => {
    const photo = byId.get(id);
    if (!photo || photo.photography_session_id !== sessionId) {
      throw new DerivativeError(`photo ${id} does not belong to this session`, "foreign_photo");
    }
    if (photo.public_derivative_url && photo.public_derivative_content_hash === photo.content_hash) {
      return {
        photoId: photo.id, url: photo.public_derivative_url,
        storagePath: derivativeStoragePath(sessionId, photo.id, photo.content_hash), reused: true,
      };
    }
    return buildDerivative(client, sessionId, photo);
  });
}

export interface PrepareDerivativesArgs {
  client: SupabaseClient;
  itemId: string;
}

export async function prepareApprovedDerivatives(args: PrepareDerivativesArgs): Promise<DerivativeResult[]> {
  const { client, itemId } = args;

  const { data: item, error: iErr } = await client.from("session_content_items")
    .select("id,content_type,status,payload,package_id").eq("id", itemId).maybeSingle();
  if (iErr || !item) throw new DerivativeError(`content item not found: ${iErr?.message ?? itemId}`, "not_found");
  if (item.status !== "approved") {
    throw new DerivativeError(`item is not approved (status=${item.status})`, "not_approved");
  }

  const { data: pkg } = await client.from("session_content_packages")
    .select("photography_session_id").eq("id", item.package_id).single();
  const sessionId = pkg!.photography_session_id as string;

  const { data: session } = await client.from("photography_sessions")
    .select("marketing_permission").eq("id", sessionId).single();
  if (!session?.marketing_permission) {
    throw new DerivativeError("marketing permission is not enabled for this session", "permission");
  }

  const ids = photoIdsFromPayload(item.content_type, item.payload as Record<string, unknown>);
  if (ids.length === 0) return [];

  // photo ids are derived from the item's VALIDATED payload (spec §4.3)
  const validated = validatePayload(item.content_type, item.payload);
  if (!validated.success) {
    throw new DerivativeError(`item payload is invalid: ${validated.error.message}`, "payload");
  }

  const { data: photos, error: pErr } = await client.from("session_photos")
    .select("id,photography_session_id,storage_path,content_hash,public_derivative_url,public_derivative_content_hash")
    .in("id", ids);
  if (pErr) throw new DerivativeError(`could not load photos: ${pErr.message}`, "storage");
  const byId = new Map((photos ?? []).map((p) => [p.id as string, p as PhotoRow]));

  const results: DerivativeResult[] = [];
  for (const id of ids) {
    const photo = byId.get(id);
    if (!photo || photo.photography_session_id !== sessionId) {
      throw new DerivativeError(`photo ${id} does not belong to this item's session`, "foreign_photo");
    }
    if (photo.public_derivative_url && photo.public_derivative_content_hash === photo.content_hash) {
      results.push({
        photoId: photo.id, url: photo.public_derivative_url,
        storagePath: derivativeStoragePath(sessionId, photo.id, photo.content_hash), reused: true,
      });
      continue;
    }
    results.push(await buildDerivative(client, sessionId, photo));
  }
  return results;
}
