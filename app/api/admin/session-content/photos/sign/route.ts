import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  ORIGINALS_BUCKET,
  MAX_UPLOAD_BYTES,
  isAllowedMime,
  issueUploadPath,
} from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: {
    sessionId?: unknown;
    filename?: unknown;
    mime?: unknown;
    sizeBytes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const mime = typeof body.mime === "string" ? body.mime : "";
  const sizeBytes =
    typeof body.sizeBytes === "number" ? body.sizeBytes : -1;

  if (!UUID_RE.test(sessionId))
    return NextResponse.json(
      { error: "sessionId must be a uuid" },
      { status: 400 },
    );

  const normalizedSessionId = sessionId.toLowerCase();

  if (!isAllowedMime(mime))
    return NextResponse.json(
      { error: "unsupported MIME type" },
      { status: 400 },
    );
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `sizeBytes must be 1..${MAX_UPLOAD_BYTES}` },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: session, error: sErr } = await admin
    .from("photography_sessions")
    .select("id")
    .eq("id", normalizedSessionId)
    .maybeSingle();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session)
    return NextResponse.json(
      { error: "photography session not found" },
      { status: 404 },
    );

  const path = issueUploadPath(normalizedSessionId, mime);
  const { data, error } = await admin.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("sign upload url failed", error);
    return NextResponse.json(
      { error: "could not create signed upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    bucket: ORIGINALS_BUCKET,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
