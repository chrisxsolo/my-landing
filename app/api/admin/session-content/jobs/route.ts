// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/session-content/jobs — the admin side of a background content run.
//
// POST   { sessionId }  enqueue (idempotent — returns the live job if there is
//                       one) and kick the worker so it starts straight away.
// GET    ?sessionId=    the session's latest job, for the workspace's progress
//                       line. Deliberately small: this is what gets polled, so
//                       it must not re-sign photo thumbnails.
// DELETE { sessionId }  cancel the live job; the worker stops at its next step.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { JOB_COLUMNS, type ContentEngineJob } from "@/lib/contentEngine/jobRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function sessionIdFromBody(req: NextRequest): Promise<string | null> {
  try {
    const body = (await req.json()) as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.toLowerCase() : "";
    return isUuid(sessionId) ? sessionId : null;
  } catch {
    return null;
  }
}

// Best-effort nudge so the run starts now rather than on the next cron tick.
// The enqueue is already committed and the recurring tick (see the worker
// route) will claim the job regardless, so this failing — or being frozen
// before it leaves — only costs latency, never the run.
function kickWorker(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  void fetch(new URL("/api/content-engine/worker", req.nextUrl.origin), {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    cache: "no-store",
  }).catch(() => {});
  return true;
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
    // False means CRON_SECRET is unset: the job is queued but no worker can be
    // reached, so the UI should say so instead of spinning forever.
    kicked: kickWorker(req),
  });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("content_engine_jobs")
    .select(JOB_COLUMNS)
    .eq("photography_session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("job lookup failed", error);
    return NextResponse.json({ error: "could not look up the run" }, { status: 500 });
  }
  return NextResponse.json({ job: (data as ContentEngineJob | null) ?? null });
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
