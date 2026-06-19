import { supabase } from "@/lib/supabase";

type SignedTarget = { bucket: string; path: string; token: string };

// Uploads one file straight to Storage through a server-issued signed URL, so the
// bytes skip the serverless request-body limit that breaks large uploads through
// an API route. Returns the stored object's bucket + path; throws with a usable
// message on failure. `prefix` is the target's location slug / fact slug / folder.
export async function uploadToSignedTarget(
  target: string,
  prefix: string,
  file: File,
): Promise<{ bucket: string; path: string }> {
  const res = await fetch("/api/admin/storage/sign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, prefix, mime: file.type, sizeBytes: file.size }),
  });
  const signed = (await res.json().catch(() => null)) as (SignedTarget & { error?: string }) | null;
  if (!res.ok || !signed?.token) {
    throw new Error(signed?.error ?? "Could not start the upload.");
  }
  const { error } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return { bucket: signed.bucket, path: signed.path };
}
