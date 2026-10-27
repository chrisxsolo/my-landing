// Server-only: gathers the content sync health report. The parts run in
// parallel and fail independently (see settlePart). Read-only: the campus
// spot check is the sync's own dry run, which never writes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRecentSyncRuns } from "@/lib/photoSync/runLog";
import { loadAudit, toReport } from "@/lib/photoTagging/library";
import { syncCampusSpotPhotos } from "@/lib/campusSpotFill/sync";
import { LOCATIONS_TABLE } from "@/lib/locationLibrary/taxonomy";
import {
  campusSpotHealthFrom, settlePart, syncHealthFrom, taggingHealthFrom,
  type ContentHealthReport, type GuideReviewDto,
} from "@/lib/contentHealth/report";

/** Recent runs read for the sync summary; older failures are long since superseded. */
const SYNC_RUNS_WINDOW = 100;

// Location library drafts waiting for Chris: not live, flagged for review
// (the "review" status in lib/locationLibrary/adminView.ts statusOf).
async function guidesAwaitingReview(client: SupabaseClient): Promise<GuideReviewDto> {
  const { count, error } = await client.from(LOCATIONS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("active", false).eq("needs_review", true);
  if (error) throw new Error(`could not count location drafts: ${error.message}`);
  if (count === null) throw new Error("location draft count missing");
  return { awaitingReview: count };
}

export async function loadContentHealth(client: SupabaseClient): Promise<ContentHealthReport> {
  const [sync, tagging, campusSpots, locationGuides] = await Promise.all([
    settlePart("photo sync runs", async () => syncHealthFrom(await loadRecentSyncRuns(client, SYNC_RUNS_WINDOW))),
    settlePart("photo tagging", async () => taggingHealthFrom(toReport(await loadAudit(client)))),
    settlePart("campus spots", async () => campusSpotHealthFrom(await syncCampusSpotPhotos(client, { apply: false }))),
    settlePart("location guides", () => guidesAwaitingReview(client)),
  ]);
  return { sync, tagging, campusSpots, locationGuides };
}
