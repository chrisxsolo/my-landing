// Server-only: when the campus-spot photo sync runs.
//   • after an admin action that changes which photos are public or where they
//     belong (portfolio save, Content Engine publish / facts / location,
//     Page Photos edit, campus spot edit) — queued after the response, so a
//     sync problem can never fail the admin's own action
//   • on worker ticks (scheduled every 5 minutes, but GitHub often delays
//     them by hours — the Content Sync Health card shows the last one) as the backstop, which also
//     covers the first backfill after deploy
//   • on demand from Admin → photo sync (a run or a retry of a failed run)
// Each run is idempotent, so overlapping runs are safe, and each is logged in
// photo_sync_runs (lib/photoSync/runLog) so a failure is visible and retryable.
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { runLogged, type LoggedRun, type SyncOutcome, type SyncTrigger } from "@/lib/photoSync/runLog";
import { syncCampusSpotPhotos, type CampusSpotSyncReport } from "@/lib/campusSpotFill/sync";

/** What the run log keeps of a campus-spot report. Pure. */
export function summarizeCampusSpotSync(report: CampusSpotSyncReport): SyncOutcome {
  return {
    detail: {
      filled: report.claimed.length, released: report.released.length, kept: report.kept.length,
      lostRaces: report.lostRaces, unmatched: report.unmatched.length,
    },
  };
}

/** One logged, applied sync. Never throws: a failure is in the result (and the log). */
export async function runCampusSpotSyncLogged(
  trigger: SyncTrigger, retryOf: number | null = null,
): Promise<LoggedRun<CampusSpotSyncReport>> {
  const client = createSupabaseAdminClient();
  return runLogged(client, { kind: "campus_spots", scope: null, trigger, retryOf }, async () => {
    const report = await syncCampusSpotPhotos(client, { apply: true });
    if (report.claimed.length > 0 || report.released.length > 0) {
      console.info(`[campus-spots] filled ${report.claimed.length}, released ${report.released.length}`);
      revalidatePublicContent();
    }
    return report;
  }, summarizeCampusSpotSync);
}

export async function runCampusSpotSync(trigger: SyncTrigger = "admin"): Promise<CampusSpotSyncReport> {
  const run = await runCampusSpotSyncLogged(trigger);
  if ("thrown" in run) throw run.thrown;
  return run.result as CampusSpotSyncReport;
}

/** Queues a sync after the response. Never throws into the caller. */
export function syncCampusSpotPhotosInBackground(): void {
  try {
    after(async () => {
      try {
        await runCampusSpotSync();
      } catch (err) {
        console.error("[campus-spots] background sync failed", err);
      }
    });
  } catch (err) {
    console.error("[campus-spots] could not schedule a background sync", err);
  }
}

/** The worker-tick backstop. Never throws. */
export async function sweepCampusSpotPhotos(): Promise<{ filled: number; released: number } | null> {
  try {
    const run = await runCampusSpotSyncLogged("worker");
    if (run.skipped) return null;
    if ("thrown" in run) throw run.thrown;
    if (!run.result) throw new Error(run.error ?? "campus spot sync returned no report");
    return { filled: run.result.claimed.length, released: run.result.released.length };
  } catch (err) {
    console.error("[campus-spots] sweep failed", err);
    return null;
  }
}
