import { supabase } from "@/lib/supabase";

export async function uploadImage(
  file: File,
  folder: string,
  toast: (msg: string, ok?: boolean) => void,
): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // Random suffix keeps parallel uploads (same millisecond) from colliding under upsert.
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("grad-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) {
    console.error("Upload error:", error);
    toast(`Image upload failed: ${error.message}`, false);
    return null;
  }
  return supabase.storage.from("grad-photos").getPublicUrl(path).data.publicUrl;
}
