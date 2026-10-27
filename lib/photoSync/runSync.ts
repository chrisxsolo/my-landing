// Server-only: runs one photo sync on demand (Admin → photo sync), logged in
// photo_sync_runs. A retry re-runs the failed run's kind and scope now, with
// trigger 'retry' and a link back to the run it retries.
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCampusSpotSyncLogged } from "@/lib/campusSpotFill/autoSync";
import { syncAllSessionsLogged, syncSessionLogged } from "@/lib/locationLibrary/autoSync";
import { loadSyncRun, type LoggedRun, type SyncKind, type SyncTrigger } from "@/lib/photoSync/runLog";

export interface PhotoSyncRequest {
  kind: SyncKind;
  /** A session uuid (location library only), or null for a full sync. */
  scope: string | null;
  trigger: SyncTrigger;
  retryOf?: number | null;
}

export interface PhotoSyncResult {
  ok: boolean;
  runId: number | null;
  error?: string;
}

function toResult(run: LoggedRun<unknown>): PhotoSyncResult {
  if (run.ok) return { ok: true, runId: run.runId };
  if (run.thrown) console.error("[photo-sync] sync failed", run.thrown);
  return { ok: false, runId: run.runId, error: run.error ?? "sync failed" };
}

/** Runs the sync now. Never throws: a failure is in the result and in the log. */
export async function runPhotoSync(req: PhotoSyncRequest): Promise<PhotoSyncResult> {
  const retryOf = req.retryOf ?? null;
  if (req.kind === "campus_spots") return toResult(await runCampusSpotSyncLogged(req.trigger, retryOf));
  return toResult(req.scope
    ? await syncSessionLogged(req.scope, req.trigger, retryOf)
    : await syncAllSessionsLogged(req.trigger, retryOf));
}

/** Re-runs a logged run's kind and scope now; null when that run does not exist. */
export async function retryPhotoSync(client: SupabaseClient, runId: number): Promise<PhotoSyncResult | null> {
  const run = await loadSyncRun(client, runId);
  if (!run) return null;
  return runPhotoSync({ kind: run.kind, scope: run.kind === "campus_spots" ? null : run.scope, trigger: "retry", retryOf: run.id });
}
