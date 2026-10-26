// POST { sessionId? , dryRun? } — the manual resync. With a sessionId, syncs
// that session (and profiles any draft it creates); without, syncs every
// session (claiming hand-written rows for their places first). Idempotent:
// running it twice changes nothing the second time.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { profileNewDrafts, syncSessionNow } from "@/lib/locationLibrary/autoSync";
import { syncAllSessions, syncSessionLocations } from "@/lib/locationLibrary/sync";
import { errorResponse, readJson } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // a full resync may profile several new drafts

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = (await readJson(req)) ?? {};
  const dryRun = body.dryRun === true;
  try {
    if (typeof body.sessionId === "string") {
      if (!isUuid(body.sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
      const sessionId = body.sessionId.toLowerCase();
      const report = dryRun
        ? await syncSessionLocations(createSupabaseAdminClient(), sessionId, { dryRun })
        : await syncSessionNow(sessionId);
      return NextResponse.json({ sessions: [report] });
    }
    const client = createSupabaseAdminClient();
    const report = await syncAllSessions(client, { dryRun });
    if (!dryRun) {
      await profileNewDrafts(client, report.sessions.flatMap((s) => s.createdLocationIds));
      revalidatePublicContent();
    }
    return NextResponse.json(report);
  } catch (err) {
    return errorResponse(err, "location sync failed");
  }
}
