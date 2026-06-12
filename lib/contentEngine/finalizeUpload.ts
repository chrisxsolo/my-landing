// Server-side upload finalization (spec §4.2 steps 3-6). The browser-declared
// metadata is convenience only; this function trusts ONLY what it downloads and
// verifies. On any failure it deletes the object it owns and throws.
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyImageBuffer, ImageVerificationError } from "@/lib/contentEngine/imageVerification";
import { needsNormalization, normalizeOriginal } from "@/lib/contentEngine/normalizeOriginal";
import { ORIGINALS_BUCKET, isOwnedUploadPath } from "@/lib/contentEngine/uploadConfig";

export type UploadFinalizationErrorKind =
  | "ownership" | "download" | "verification" | "duplicate" | "insert";

export class UploadFinalizationError extends Error {
  readonly kind: UploadFinalizationErrorKind;
  constructor(message: string, kind: UploadFinalizationErrorKind) {
    super(message);
    this.name = "UploadFinalizationError";
    this.kind = kind;
  }
}

export interface DeclaredUploadMeta {
  filename: string;
  mime: string;
  sizeBytes: number;
  contentHash: string; // client-claimed; never trusted — logged when it mismatches the server hash
}

export interface FinalizeUploadArgs {
  client: SupabaseClient;
  sessionId: string;
  storagePath: string;
  declared: DeclaredUploadMeta;
}

export interface SessionPhotoRow {
  id: string;
  storage_path: string;
  content_hash: string;
  width: number;
  height: number;
  mime_type: string;
  analysis_status: string;
}

async function removeOwnedObject(client: SupabaseClient, path: string) {
  const { error } = await client.storage.from(ORIGINALS_BUCKET).remove([path]);
  if (error) {
    // Lingering private objects are reclaimed by the deferred cleanup sweep
    // (spec §4.4); log so the failure is traceable.
    console.error(`failed to remove uploaded object ${path}:`, error.message);
  }
}

export async function finalizeUpload(args: FinalizeUploadArgs): Promise<SessionPhotoRow> {
  const { client, sessionId, storagePath, declared } = args;

  // (5) Path ownership: never delete or register a path we don't own.
  if (!isOwnedUploadPath(storagePath, sessionId)) {
    throw new UploadFinalizationError(
      `storage path is not owned by session ${sessionId}: ${storagePath}`,
      "ownership",
    );
  }

  // (4a) Download the object (service role).
  const { data: blob, error: dlErr } = await client.storage.from(ORIGINALS_BUCKET).download(storagePath);
  if (dlErr || !blob) {
    throw new UploadFinalizationError(
      `could not download finalized object: ${dlErr?.message ?? "missing"}`,
      "download",
    );
  }
  const buffer = Buffer.from(await blob.arrayBuffer());

  // (4b) Authoritative verification; invalid → delete + reject (6).
  let verified;
  try {
    verified = await verifyImageBuffer(buffer);
  } catch (err) {
    await removeOwnedObject(client, storagePath);
    const reason = err instanceof ImageVerificationError ? err.message : String(err);
    throw new UploadFinalizationError(`image verification failed: ${reason}`, "verification");
  }

  // Oversized originals are downscaled and re-stored over the SAME path before
  // the row is inserted, so hash/dimensions below always describe the stored
  // bytes. The upsert must succeed before re-verification — a row must never
  // reference bytes that aren't in storage.
  if (needsNormalization(verified)) {
    try {
      const normalized = await normalizeOriginal(buffer, verified.format);
      const contentType = verified.format === "jpeg" ? "image/jpeg" : `image/${verified.format}`;
      const { error: upErr } = await client.storage.from(ORIGINALS_BUCKET)
        .upload(storagePath, normalized, { contentType, upsert: true });
      if (upErr) throw new Error(`re-upload failed: ${upErr.message}`);
      verified = await verifyImageBuffer(normalized);
    } catch (err) {
      await removeOwnedObject(client, storagePath);
      const reason = err instanceof Error ? err.message : String(err);
      throw new UploadFinalizationError(`oversized image normalization failed: ${reason}`, "verification");
    }
  }

  const format = verified.format === "jpeg" ? "image/jpeg" : `image/${verified.format}`;

  // Telemetry: client hash is convenience only (spec §4.2); a mismatch means the
  // browser hashed different bytes than were stored — worth a trace.
  if (declared.contentHash && declared.contentHash !== verified.hash) {
    console.warn(
      `client-declared hash mismatch for ${storagePath}: declared ${declared.contentHash}, server ${verified.hash}`,
    );
  }

  // (6) Insert with SERVER-computed hash/dimensions. The unique
  // (photography_session_id, content_hash) prevents accidental re-upload.
  const { data, error } = await client
    .from("session_photos")
    .insert({
      photography_session_id: sessionId,
      storage_path: storagePath,
      content_hash: verified.hash,
      original_filename: declared.filename,
      width: verified.width,
      height: verified.height,
      mime_type: format,
      file_size_bytes: verified.bytes,
      analysis_status: "pending",
    })
    .select("id,storage_path,content_hash,width,height,mime_type,analysis_status")
    .single();

  if (error) {
    // On a unique-constraint violation (23505) we NEVER delete the object.
    //
    // Same-path double-finalize: the winner's committed row references this
    // exact object — deleting it would orphan that row.
    //
    // Different-path duplicate (same bytes, different path): the object is a
    // true orphan, but eagerly deleting here would introduce a TOCTOU race
    // (our existence-check could run before the winner's INSERT commits).
    // True orphans are reclaimed by the deferred cleanup sweep (spec §4.4).
    //
    // For non-duplicate failures the object is ours to clean up.
    const isDuplicate = error.code === "23505";
    if (!isDuplicate) {
      await removeOwnedObject(client, storagePath);
    }
    throw new UploadFinalizationError(
      isDuplicate
        ? `duplicate photo: this image is already uploaded for this session (${error.message})`
        : `could not record session photo: ${error.message}`,
      isDuplicate ? "duplicate" : "insert",
    );
  }
  return data as SessionPhotoRow;
}
