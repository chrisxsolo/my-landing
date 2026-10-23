// Server-only entry points for running the content worker.
//
// A run moves forward in three ways, fastest first:
//   1. after() in the admin's own request — enqueueing a run (or polling one
//      that has stalled) works the job inside that same invocation, after the
//      response is sent, within the route's maxDuration;
//   2. continuation — an invocation that runs out of budget hands the job back
//      as 'queued' and POSTs the worker route, which answers at once and works
//      the job in its own after();
//   3. the recurring tick (GitHub Actions every 5 minutes, plus a daily Vercel
//      cron) — the durable backstop when 1 and 2 never land.
// Every path goes through runWorkerOnce, whose claim is atomic and leased, so
// any number of them firing at once still works each job exactly once.
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { runWorkerOnce, type RunWorkerResult } from "@/lib/contentEngine/jobRunner";

const WORKER_PATH = "/api/content-engine/worker";
// The worker's POST answers before doing any work, so this only has to cover
// connection setup and a cold start.
const CONTINUATION_TIMEOUT_MS = 15_000;

/** Asks a fresh invocation to keep working the queue. Best-effort: the tick is the backstop. */
export async function requestContinuation(origin: string): Promise<void> {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return;
  try {
    await fetch(new URL(WORKER_PATH, origin), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(CONTINUATION_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn("content worker continuation did not land; the next tick picks the run up", err);
  }
}

/** Claims and works one job in this invocation; requests a continuation if it ran out of budget. */
export async function drainOnce(origin: string): Promise<RunWorkerResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const result = await runWorkerOnce({
    client: createSupabaseAdminClient(),
    callModel: createAnthropicCaller(apiKey),
  });
  if (result.handedOff) await requestContinuation(origin);
  return result;
}

/**
 * Works the queue after the current response is sent. Returns false when no
 * worker can run here (no API key), so the caller can say so.
 */
export function drainInBackground(origin: string): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  after(async () => {
    try {
      await drainOnce(origin);
    } catch (err) {
      console.error("background content worker failed", err);
    }
  });
  return true;
}
