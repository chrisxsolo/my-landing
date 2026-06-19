import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  COUPLES_INSPIRATION_BUCKET,
  MAX_COUPLES_IMAGE_BYTES,
  couplesImageExtForMime,
} from "@/lib/couplesPosingGuide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issues a signed upload URL so the browser can send file bytes straight to
// Supabase Storage, bypassing the serverless request-body limit that breaks
// large batch uploads through the API route. The server owns the path.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { mime?: unknown; sizeBytes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const mime = typeof body.mime === "string" ? body.mime : "";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : -1;

  const ext = couplesImageExtForMime(mime);
  if (!ext) {
    return NextResponse.json(
      { error: "Upload a JPEG, PNG, WebP, or AVIF image." },
      { status: 400 },
    );
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_COUPLES_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Images must be 6 MB or smaller." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(COUPLES_INSPIRATION_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[admin/couples-posing-guide/sign] failed to sign upload", error);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }

  return NextResponse.json({ bucket: COUPLES_INSPIRATION_BUCKET, path: data.path, token: data.token });
}
