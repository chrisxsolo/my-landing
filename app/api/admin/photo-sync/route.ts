// /api/admin/photo-sync — the photo sync run log (campus spots, location library).
//   GET                                 → { runs, health }: the 50 most recent runs,
//                                         the last success per kind and failures
//                                         not healed by a later successful run
//   POST { action: "retry", runId }     → re-runs that run's kind and scope now
//   POST { action: "run", kind }        → a full sync of that kind now
//   POST answers { ok, runId, error? }   (runId = the new run's id)
// requireAdmin + service role.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { loadRecentSyncRuns, summarizeSyncRuns } from "@/lib/photoSync/runLog";
import { retryPhotoSync, runPhotoSync, type PhotoSyncResult } from "@/lib/photoSync/runSync";
import { parseSyncAction } from "@/lib/photoSync/syncAction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // a full location sync may profile several new drafts

const RECENT_RUNS = 50;

function fail(err: unknown, fallback: string) {
  console.error(`[admin/photo-sync] ${fallback}`, err);
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });
}

/** A sync that ran but failed answers 500 with the same body shape. */
function respond(result: PhotoSyncResult) {
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const runs = await loadRecentSyncRuns(createSupabaseAdminClient(), RECENT_RUNS);
    return NextResponse.json({ runs, health: summarizeSyncRuns(runs) });
  } catch (err) {
    return fail(err, "could not load photo sync runs");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const parsed = parseSyncAction(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ ok: false, runId: null, error: parsed.error }, { status: 400 });
  try {
    if (parsed.action === "run") return respond(await runPhotoSync({ kind: parsed.kind, scope: null, trigger: "admin" }));
    const result = await retryPhotoSync(createSupabaseAdminClient(), parsed.runId);
    if (!result) return NextResponse.json({ ok: false, runId: null, error: `sync run ${parsed.runId} not found` }, { status: 404 });
    return respond(result);
  } catch (err) {
    return fail(err, "photo sync failed");
  }
}
