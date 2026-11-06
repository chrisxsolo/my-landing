// ─────────────────────────────────────────────────────────────────────────────
// /api/content-publishing/worker — the scheduled-publishing tick.
//
// GET  — bearer CRON_SECRET. Called every minute by pg_cron on the Supabase
//        project (migration 20261106000002) and daily by vercel.json as a
//        sweep. Claims the due schedules, publishes them, retries pending
//        cache refreshes, records a heartbeat. Idempotent: overlapping or
//        duplicated ticks never publish anything twice.
// POST — admin cookie (or the bearer): "Run now" from the queue page.
//
// Fails closed: with no CRON_SECRET configured no bearer is trusted. Preview
// deployments share the production database, so they refuse to run the queue
// — only the canonical production host may consume production schedules.
// Independent of ANTHROPIC_API_KEY: publishing reviewed content needs no model.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { runPublicationWorker, type WorkerSummary } from "@/lib/contentPublishing/worker";
import { syncItemSessionInBackground } from "@/lib/locationLibrary/autoSync";
import { syncCampusSpotPhotosInBackground } from "@/lib/campusSpotFill/autoSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Next needs the literal here; constants.ts pins it so the lease outlasts it (tested).
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function hasCronAuth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
}

/** Preview deployments must never work the production queue. */
function isPreviewDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "preview";
}

const revalidate = {
  tag: (tag: string, profile: { expire: number }) => revalidateTag(tag, profile),
  path: (path: string, type?: "page" | "layout") => (type ? revalidatePath(path, type) : revalidatePath(path)),
};

async function tick(source: string): Promise<NextResponse> {
  if (isPreviewDeployment()) {
    return NextResponse.json({ error: "preview deployments do not run the publication queue" }, { status: 409 });
  }
  let summary: WorkerSummary;
  try {
    summary = await runPublicationWorker({ client: createSupabaseAdminClient(), source, revalidate });
  } catch (err) {
    const error = err instanceof Error ? err.message : "worker failed";
    if (/publication_schedules|relation .* does not exist|42P01|claim_publication_schedules/i.test(error)) {
      console.warn("publication worker idle: migration 20261106000001 is not applied yet");
      return NextResponse.json({ error: "queue table missing", pendingMigration: true }, { status: 503 });
    }
    console.error("publication worker failed", err);
    return NextResponse.json({ error }, { status: 500 });
  }
  // The same follow-ups the immediate publish kicks (location library,
  // campus-spot fill) run after the response, never inside the tick.
  if (summary.publishedItemIds.length > 0) {
    after(() => {
      for (const itemId of summary.publishedItemIds) syncItemSessionInBackground(itemId);
      syncCampusSpotPhotosInBackground();
    });
  }
  return NextResponse.json(summary);
}

export async function GET(req: NextRequest) {
  if (!hasCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return tick(req.headers.get("x-publication-tick") === "pg_cron" ? "cron" : "bearer");
}

export async function POST(req: NextRequest) {
  if (!hasCronAuth(req)) {
    const deny = requireAdmin(req);
    if (deny) return deny;
  }
  return tick("admin");
}
