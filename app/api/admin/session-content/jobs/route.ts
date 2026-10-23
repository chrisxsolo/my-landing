// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/session-content/jobs — the admin side of a background content run.
//
// POST   { sessionId }  enqueue (idempotent — returns the live job if there is
//                       one) and work it right away, after the response, in
//                       this same invocation.
// GET    ?sessionId=    the session's latest job plus each photo's analysis
//                       status, for live progress. Deliberately small: this is
//                       what gets polled, so it must not re-sign thumbnails.
//                       A poll that finds the run stalled (queued, or its
//                       worker died) also restarts it.
// DELETE { sessionId }  cancel the live job; the worker stops at its next step.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { JOB_COLUMNS, type ContentEngineJob } from "@/lib/contentEngine/jobRunner";
import { drainInBackground } from "@/lib/contentEngine/workerDrain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The worker may run inside this route's after() — give it the same budget.
export const maxDuration = 300;

const PHOTO_STATUS_COLUMNS =
  "id,excluded,analysis_status,analysis_started_at,analysis_lease_expires_at,analyzed_at,quality_score,analysis_error";

async function sessionIdFromBody(req: NextRequest): Promise<string | null> {
  try {
    const body = (await req.json()) as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.toLowerCase() : "";
    return isUuid(sessionId) ? sessionId : null;
  } catch {
    return null;
  }
}

/** Queued, or running under a lease that has lapsed (its worker died). */
function isClaimable(job: ContentEngineJob, nowMs: number): boolean {
  if (job.status === "queued") return true;
  return job.status === "running"
    && (job.lease_expires_at === null || Date.parse(job.lease_expires_at) <= nowMs);
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sessionId = await sessionIdFromBody(req);
  if (!sessionId) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("enqueue_content_engine_job", { p_session_id: sessionId });
  if (error) {
    const status = /ai processing is not allowed/i.test(error.message) ? 403
      : /not found/i.test(error.message) ? 404 : 422;
    return NextResponse.json({ error: error.message }, { status });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; created: boolean } | undefined;
  if (!row?.job_id) return NextResponse.json({ error: "could not enqueue the run" }, { status: 500 });

  const { data: job } = await admin
    .from("content_engine_jobs").select(JOB_COLUMNS).eq("id", row.job_id).maybeSingle();

  return NextResponse.json({
    job: job as ContentEngineJob | null,
    created: row.created,
    // False means a run was already in flight and this request adopted it —
    // the caller should not report that it started a second one.
    adopted: !row.created,
    // False means no worker can run here (ANTHROPIC_API_KEY unset), so the UI
    // should say so instead of spinning forever.
    kicked: drainInBackground(req.nextUrl.origin),
  });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const [jobRes, photosRes] = await Promise.all([
    admin
      .from("content_engine_jobs")
      .select(JOB_COLUMNS)
      .eq("photography_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("session_photos")
      .select(PHOTO_STATUS_COLUMNS)
      .eq("photography_session_id", sessionId),
  ]);
  if (jobRes.error || photosRes.error) {
    console.error("run progress lookup failed", jobRes.error ?? photosRes.error);
    return NextResponse.json({ error: "could not look up the run" }, { status: 500 });
  }
  const job = (jobRes.data as unknown as ContentEngineJob | null) ?? null;
  const serverNow = Date.now();
  // Someone is watching a run that nothing is working: pick it up here rather
  // than waiting for the next tick. The claim is atomic, so overlapping polls
  // (or a tick landing at the same moment) cannot double-work it.
  if (job && isClaimable(job, serverNow)) drainInBackground(req.nextUrl.origin);
  return NextResponse.json({ job, photoStatuses: photosRes.data ?? [], serverNow });
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sessionId = await sessionIdFromBody(req);
  if (!sessionId) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  // The worker guards every progress write with status='running', so flipping
  // the status here is enough to stop it at the next step boundary. The step in
  // flight is allowed to finish and is never rolled back — its output is a
  // draft, and drafts are idempotent.
  const { data, error } = await admin
    .from("content_engine_jobs")
    .update({
      status: "cancelled", lease_expires_at: null,
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    .eq("photography_session_id", sessionId)
    .in("status", ["queued", "running"])
    .select("id");
  if (error) {
    console.error("job cancel failed", error);
    return NextResponse.json({ error: "could not cancel the run" }, { status: 500 });
  }
  return NextResponse.json({ cancelled: (data ?? []).length });
}
