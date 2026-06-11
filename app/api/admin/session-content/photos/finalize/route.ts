import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  finalizeUpload,
  UploadFinalizationError,
} from "@/lib/contentEngine/finalizeUpload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: {
    sessionId?: unknown;
    storagePath?: unknown;
    filename?: unknown;
    mime?: unknown;
    sizeBytes?: unknown;
    contentHash?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const storagePath =
    typeof body.storagePath === "string" ? body.storagePath : "";

  if (!UUID_RE.test(sessionId))
    return NextResponse.json(
      { error: "sessionId must be a uuid" },
      { status: 400 },
    );

  const normalizedSessionId = sessionId.toLowerCase();

  if (!storagePath)
    return NextResponse.json(
      { error: "storagePath is required" },
      { status: 400 },
    );

  const admin = createSupabaseAdminClient();
  try {
    const row = await finalizeUpload({
      client: admin,
      sessionId: normalizedSessionId,
      storagePath,
      declared: {
        filename:
          typeof body.filename === "string" ? body.filename : "upload",
        mime: typeof body.mime === "string" ? body.mime : "",
        sizeBytes:
          typeof body.sizeBytes === "number" ? body.sizeBytes : 0,
        contentHash:
          typeof body.contentHash === "string" ? body.contentHash : "",
      },
    });
    return NextResponse.json({ photo: row });
  } catch (err) {
    if (err instanceof UploadFinalizationError) {
      const status = err.kind === "duplicate" ? 409 : 422;
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status },
      );
    }
    console.error("finalizeUpload unexpected error", err);
    return NextResponse.json(
      { error: "upload finalization failed" },
      { status: 500 },
    );
  }
}
