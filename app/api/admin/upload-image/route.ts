// Admin API for generic image uploads to the public `grad-photos` bucket.
// Gated by requireAdmin and uses the service-role client, so the public anon key
// can never write here. Mirrors app/api/admin/about-photos validation/error
// pattern (validateAdminPhotoFile, safePhotoFileName). Callers POST a multipart
// `file` + `folder` and get back the public URL.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import { validateAdminPhotoFile, safePhotoFileName } from "@/lib/photoAdminShared";

export const dynamic = "force-dynamic";

const GRAD_PHOTOS_BUCKET = "grad-photos";

// Allowlist of folder prefixes the admin tabs upload into. Keeps the `folder`
// form field from being used for path traversal or to write outside known areas.
const ALLOWED_FOLDERS = new Set([
  "locations",
  "poses",
  "bay-area-locations",
  "blog",
  "case-studies",
  "portfolio",
  "library",
]);

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/upload-image] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

// ── POST (multipart): upload an image and return its public URL ───────────────
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const folder = form.get("folder");

    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    if (typeof folder !== "string" || !ALLOWED_FOLDERS.has(folder)) {
      throw new Error("Unknown upload folder.");
    }
    const fileCheck = validateAdminPhotoFile(file);
    if (!fileCheck.ok) throw new Error(fileCheck.error);

    const supabase = createSupabaseAdminClient();
    const path = `${folder}/${crypto.randomUUID()}-${safePhotoFileName(file.name, "image")}`;

    const { error: uploadError } = await supabase.storage
      .from(GRAD_PHOTOS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const url = supabase.storage.from(GRAD_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to upload the image.", 400);
  }
}
