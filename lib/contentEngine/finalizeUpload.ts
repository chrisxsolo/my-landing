// Server-side upload finalization (spec §4.2 steps 3-6). The browser-declared
// metadata is convenience only; this function trusts ONLY what it downloads and
// verifies. On any failure it deletes the object it owns and throws.
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyImageBuffer, ImageVerificationError } from "@/lib/contentEngine/imageVerification";
import { ORIGINALS_BUCKET, isOwnedUploadPath } from "@/lib/contentEngine/uploadConfig";

export class UploadFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadFinalizationError";
  }
}

export interface DeclaredUploadMeta {
  filename: string;
  mime: string;
  sizeBytes: number;
  contentHash: string; // client-claimed; NOT trusted (compared for telemetry only)
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
  await client.storage.from(ORIGINALS_BUCKET).remove([path]);
}

export async function finalizeUpload(args: FinalizeUploadArgs): Promise<SessionPhotoRow> {
  const { client, sessionId, storagePath, declared } = args;

  // (5) Path ownership: never delete or register a path we don't own.
  if (!isOwnedUploadPath(storagePath, sessionId)) {
    throw new UploadFinalizationError(`storage path is not owned by session ${sessionId}: ${storagePath}`);
  }

  // (4a) Download the object (service role).
  const { data: blob, error: dlErr } = await client.storage.from(ORIGINALS_BUCKET).download(storagePath);
  if (dlErr || !blob) {
    throw new UploadFinalizationError(`could not download finalized object: ${dlErr?.message ?? "missing"}`);
  }
  const buffer = Buffer.from(await blob.arrayBuffer());

  // (4b) Authoritative verification; invalid → delete + reject (6).
  let verified;
  try {
    verified = await verifyImageBuffer(buffer);
  } catch (err) {
    await removeOwnedObject(client, storagePath);
    const reason = err instanceof ImageVerificationError ? err.message : String(err);
    throw new UploadFinalizationError(`image verification failed: ${reason}`);
  }

  const format = verified.format === "jpeg" ? "image/jpeg" : `image/${verified.format}`;

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
    // Duplicate hash or any insert failure: delete the now-orphaned object.
    await removeOwnedObject(client, storagePath);
    throw new UploadFinalizationError(`could not record session photo: ${error.message}`);
  }
  return data as SessionPhotoRow;
}
