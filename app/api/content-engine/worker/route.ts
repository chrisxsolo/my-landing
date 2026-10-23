// ─────────────────────────────────────────────────────────────────────────────
// /api/content-engine/worker — drains the content-run queue.
//
// GET  — Vercel Cron (see vercel.json) and the recovery sweep. Bearer CRON_SECRET.
// POST — an immediate kick, either from the admin tab right after enqueueing or
//        from this route continuing itself. Admin cookie or bearer CRON_SECRET.
//
// One invocation claims at most one job and works it until its time budget runs
// out, then hands the job back as 'queued'. Progress never depends on the
// browser staying open.
//
// The minute-by-minute cron is what actually guarantees a run finishes. The
// continuation POST below is only an optimisation so a run doesn't idle until
// the next tick: a serverless invocation can be frozen as soon as it returns a
// response, so a fire-and-forget fetch may simply never leave. Nothing here
// relies on it landing — an unfinished job is 'queued' and the next tick claims
// it. (This is also why there is no Promise.all over jobs: one claim per
// invocation, many invocations.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { runWorkerOnce, type RunWorkerResult } from "@/lib/contentEngine/jobRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Fail-secure, exactly like /api/inquiry-digest: with no CRON_SECRET set, no
// bearer request is ever trusted.
function hasCronAuth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
}

// Best-effort continuation: one more call to this same route so the run keeps
// moving between cron ticks. Needs CRON_SECRET (the worker holds no admin
// cookie of its own).
function continueInBackground(req: NextRequest) {
  if (!CRON_SECRET) return;
  const url = new URL("/api/content-engine/worker", req.nextUrl.origin);
  void fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    cache: "no-store",
  }).catch(() => {
    // The cron sweep is the backstop; nothing to do here.
  });
}

async function drain(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let result: RunWorkerResult;
  try {
    result = await runWorkerOnce({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "worker failed";
    // Deployed ahead of its migration: say so once a tick instead of logging a
    // crash every minute until the table exists.
    if (/content_engine_jobs|relation .* does not exist|42P01/i.test(error)) {
      console.warn("content engine worker idle: migration 20261023000001 is not applied yet");
      return NextResponse.json({ error: "queue table missing", pendingMigration: true }, { status: 503 });
    }
    console.error("content engine worker failed", err);
    return NextResponse.json({ error }, { status: 500 });
  }

  if (result.handedOff) continueInBackground(req);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  if (!hasCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return drain(req);
}

export async function POST(req: NextRequest) {
  if (!hasCronAuth(req)) {
    const deny = requireAdmin(req);
    if (deny) return deny;
  }
  return drain(req);
}
