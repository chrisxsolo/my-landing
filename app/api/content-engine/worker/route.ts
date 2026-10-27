// ─────────────────────────────────────────────────────────────────────────────
// /api/content-engine/worker — drains the content-run queue.
//
// GET  — the recurring tick (GitHub Actions, Vercel daily cron). Bearer
//        CRON_SECRET. Synchronous: works one job for up to ~4.5 minutes and
//        answers with the result, so the ticker can tell an empty queue
//        ({"picked":false}) from a busy one.
// POST — a kick (a continuation from a worker that ran out of budget, or an
//        admin). Admin cookie or bearer CRON_SECRET. Answers 202 at once and
//        works the job after the response, so the caller never holds a
//        connection open for the length of a run.
//
// What guarantees a run finishes is the tick (see workerDrain.ts for the
// faster paths and why none of them is load-bearing). Jobs are leased, so an
// overlap between any of these paths is safe.
//
// maxDuration 300 is allowed on the Hobby plan because the project runs on
// Fluid compute; the job runner keeps every step inside HARD_DEADLINE_MS.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { drainInBackground, drainOnce } from "@/lib/contentEngine/workerDrain";
import type { RunWorkerResult } from "@/lib/contentEngine/jobRunner";
import { sweepLocationLibrary } from "@/lib/locationLibrary/autoSync";
import { sweepCampusSpotPhotos } from "@/lib/campusSpotFill/autoSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// The sweeps profile new places with the model, so they need real time. When a
// job already used most of the 300s budget they are skipped rather than cut
// off mid-run (a killed sweep leaves a run that never finishes); the ticker
// loops until the queue is empty, and that last cheap call does the sweeps.
const SWEEP_TIME_BUDGET_MS = 150_000;

async function runSweeps(startedAt: number) {
  if (Date.now() - startedAt > SWEEP_TIME_BUDGET_MS) {
    return { sweeps: "skipped: the job used the time budget; the next tick sweeps" };
  }
  // Backstop for the location library: heals any background sync that never ran.
  const locationSweep = await sweepLocationLibrary();
  // Same for campus-spot photos: fills empty spots and drops picks that went private.
  const campusSpotSweep = await sweepCampusSpotPhotos();
  return { locationSweep, campusSpotSweep };
}

// Fail-secure, exactly like /api/inquiry-digest: with no CRON_SECRET set, no
// bearer request is ever trusted.
function hasCronAuth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!hasCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const startedAt = Date.now();
  let result: RunWorkerResult;
  try {
    result = await drainOnce(req.nextUrl.origin);
  } catch (err) {
    const error = err instanceof Error ? err.message : "worker failed";
    // Deployed ahead of its migration: say so once a tick instead of logging a
    // crash on every tick until the table exists.
    if (/content_engine_jobs|relation .* does not exist|42P01/i.test(error)) {
      console.warn("content engine worker idle: migration 20261023000001 is not applied yet");
      return NextResponse.json({ error: "queue table missing", pendingMigration: true }, { status: 503 });
    }
    console.error("content engine worker failed", err);
    // The sweeps do not depend on the queue: a broken run must not stop them.
    return NextResponse.json({ error, ...(await runSweeps(startedAt)) }, { status: 500 });
  }
  return NextResponse.json({ ...result, ...(await runSweeps(startedAt)) });
}

export async function POST(req: NextRequest) {
  if (!hasCronAuth(req)) {
    const deny = requireAdmin(req);
    if (deny) return deny;
  }
  if (!drainInBackground(req.nextUrl.origin)) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }
  return NextResponse.json({ accepted: true }, { status: 202 });
}
