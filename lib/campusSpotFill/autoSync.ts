// Server-only: when the campus-spot photo sync runs.
//   • after an admin action that changes which photos are public or where they
//     belong (portfolio save, Content Engine publish / facts / location,
//     Page Photos edit, campus spot edit) — queued after the response, so a
//     sync problem can never fail the admin's own action
//   • on every worker tick (about every 5 minutes) as the backstop, which also
//     covers the first backfill after deploy
// Each run is idempotent, so overlapping runs are safe.
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { syncCampusSpotPhotos, type CampusSpotSyncReport } from "@/lib/campusSpotFill/sync";

export async function runCampusSpotSync(): Promise<CampusSpotSyncReport> {
  const report = await syncCampusSpotPhotos(createSupabaseAdminClient(), { apply: true });
  if (report.claimed.length > 0 || report.released.length > 0) {
    console.info(`[campus-spots] filled ${report.claimed.length}, released ${report.released.length}`);
    revalidatePublicContent();
  }
  return report;
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
    const report = await runCampusSpotSync();
    return { filled: report.claimed.length, released: report.released.length };
  } catch (err) {
    console.error("[campus-spots] sweep failed", err);
    return null;
  }
}
