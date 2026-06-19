import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateAdminPhotoFile } from "@/lib/photoAdminShared";
import { getAdminUploadTarget, issueAdminUploadPath } from "@/lib/adminUploadTargets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hands the browser a signed URL to upload one photo straight to Storage,
// bypassing the serverless request-body limit that breaks large uploads through
// an API route. The server owns the bucket and object path; callers then register
// the row (or read the public URL) via the per-feature route.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { target?: unknown; prefix?: unknown; mime?: unknown; sizeBytes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = getAdminUploadTarget(body.target);
  if (!target) {
    return NextResponse.json({ error: "Unknown upload target." }, { status: 400 });
  }

  const prefix = typeof body.prefix === "string" ? body.prefix : "";
  if (!target.isValidPrefix(prefix)) {
    return NextResponse.json({ error: "Unknown upload location." }, { status: 400 });
  }

  const mime = typeof body.mime === "string" ? body.mime : "";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
  const fileCheck = validateAdminPhotoFile({ type: mime, size: sizeBytes });
  if (!fileCheck.ok) {
    return NextResponse.json({ error: fileCheck.error }, { status: 400 });
  }
  if (sizeBytes <= 0) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const path = issueAdminUploadPath(prefix, mime);
  const { data, error } = await supabase.storage.from(target.bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[admin/storage/sign] failed to sign upload", error);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }

  return NextResponse.json({ bucket: target.bucket, path: data.path, token: data.token });
}
