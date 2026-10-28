import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  finalizeUpload,
  UploadFinalizationError,
} from "@/lib/contentEngine/finalizeUpload";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { sanitizeGps } from "@/lib/contentEngine/exifGps";
import { syncSessionLocationInheritanceSummary } from "@/lib/photoTagging/inheritLocationSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILENAME_CHARS = 255;

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
    gps?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const storagePath =
    typeof body.storagePath === "string" ? body.storagePath : "";

  if (!isUuid(sessionId))
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
          typeof body.filename === "string"
            ? body.filename.slice(0, MAX_FILENAME_CHARS)
            : "upload",
        mime: typeof body.mime === "string" ? body.mime : "",
        sizeBytes:
          typeof body.sizeBytes === "number" ? body.sizeBytes : 0,
        contentHash:
          typeof body.contentHash === "string" ? body.contentHash : "",
        gps: sanitizeGps(body.gps),
      },
    });
    // A session with exactly one location gives it to the new photo here, on
    // the server, so a refresh or a closed tab never loses it. The row exists
    // either way; a failed sync is reported with the upload (the browser
    // shows it) and is repaired by the next Session facts save or Resync.
    const locationSync = await syncSessionLocationInheritanceSummary(admin, normalizedSessionId, {
      photoIds: [row.id], reason: "photo uploaded",
    });
    return NextResponse.json({ photo: row, locationSync });
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
