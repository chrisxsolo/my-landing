// Uploads an image to the public `grad-photos` bucket via the requireAdmin-gated
// service-role route (app/api/admin/upload-image). The browser no longer touches
// the anon Supabase client for writes, so the bucket's anon INSERT policy can be
// dropped. Signature is unchanged so existing admin callers need no edits.
export async function uploadImage(
  file: File,
  folder: string,
  toast: (msg: string, ok?: boolean) => void,
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);

    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res.ok || !data?.url) {
      throw new Error(data?.error ?? "Image upload failed.");
    }
    return data.url;
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Image upload failed.";
    toast(`Image upload failed: ${message}`, false);
    return null;
  }
}
