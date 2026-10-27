// Server-only: gathers the content sync health report. The parts run in
// parallel and fail independently (see settlePart). Read-only: the campus
// spot check is the sync's own dry run, which never writes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRecentSyncRuns } from "@/lib/photoSync/runLog";
import { loadAudit, toReport } from "@/lib/photoTagging/library";
import { syncCampusSpotPhotos } from "@/lib/campusSpotFill/sync";
import { LOCATIONS_TABLE } from "@/lib/locationLibrary/taxonomy";
import { loadJobsHealth } from "@/lib/contentHealth/jobs";
import {
  campusSpotHealthFrom, settlePart, syncHealthFrom, taggingHealthFrom,
  type ContentHealthReport, type GuideReviewDto, type PublishedPhotosDto,
} from "@/lib/contentHealth/report";

const PORTFOLIO_TABLE = "portfolio_images";

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

async function publishedPhotos(client: SupabaseClient): Promise<PublishedPhotosDto> {
  const { count, error } = await client.from(PORTFOLIO_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("published", true);
  if (error) throw new Error(`could not count published photos: ${error.message}`);
  if (count === null) throw new Error("published photo count missing");
  return { published: count };
}

export async function loadContentHealth(client: SupabaseClient): Promise<ContentHealthReport> {
  const [sync, jobs, published, tagging, campusSpots, locationGuides] = await Promise.all([
    settlePart("photo sync runs", async () => syncHealthFrom(await loadRecentSyncRuns(client, SYNC_RUNS_WINDOW))),
    settlePart("content runs", () => loadJobsHealth(client)),
    settlePart("published photos", () => publishedPhotos(client)),
    settlePart("photo tagging", async () => taggingHealthFrom(toReport(await loadAudit(client)))),
    settlePart("campus spots", async () => campusSpotHealthFrom(await syncCampusSpotPhotos(client, { apply: false }))),
    settlePart("location guides", () => guidesAwaitingReview(client)),
  ]);
  return { sync, jobs, publishedPhotos: published, tagging, campusSpots, locationGuides };
}
