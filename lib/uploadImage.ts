import { supabase } from "@/lib/supabase";
import { uploadToSignedTarget } from "@/lib/adminSignedUpload";

// Uploads an image to the public `grad-photos` bucket. The file goes browser ->
// Storage via a signed URL (bypassing the serverless request-body limit that
// breaks large uploads), then the public URL is derived locally. Signature is
// unchanged so existing admin callers need no edits.
export async function uploadImage(
  file: File,
  folder: string,
  toast: (msg: string, ok?: boolean) => void,
): Promise<string | null> {
  try {
    const { bucket, path } = await uploadToSignedTarget("grad-image", folder, file);
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Image upload failed.";
    toast(`Image upload failed: ${message}`, false);
    return null;
  }
}
