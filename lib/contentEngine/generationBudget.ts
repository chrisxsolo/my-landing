// One duration budget for a generation call, shared by the manual route
// (/api/admin/session-content/generate), the background worker (jobSteps) and
// the service both call (generateContentType). Keeping the numbers together is
// the point: on 2026-11-03 the route ran with maxDuration 60 while the model
// call had the SDK's 10-minute default and the claim lease was 180s, so Vercel
// killed a new-location guide proposal mid-call and the type stayed
// `processing` with nothing left to record it failed.
//
//   route start ──▶ model work must end (GENERATION_DEADLINE_MS)
//                       └─ headroom to insert drafts, record the result, answer
//                                   ──▶ Vercel kills the function (maxDuration)
//                                              ──▶ claim lease expires (≥ maxDuration)
//
// Dependency-free apart from the retry policy type: a client component and the
// worker both import it.
import type { RetryPolicy } from "@/lib/contentEngine/retry";

/** The generate route's `maxDuration` (seconds). The route exports the literal; this pins it. */
export const GENERATE_ROUTE_MAX_DURATION_SECONDS = 300;

/** Model work in one manual generation must end this long after the route started. */
export const GENERATION_DEADLINE_MS = 240_000;

/**
 * How long claim_generation_type holds a type. Never shorter than the longest
 * invocation that could still write a result for it (the route's maxDuration,
 * the worker's hard deadline), so a second invocation can never reclaim a type
 * while the first may still finish and record it.
 */
export const GENERATION_LEASE_SECONDS = 300;

/**
 * How long a worker's claim on the OUTER job lasts between renewals. Never
 * shorter than the longest invocation that could still write job progress
 * (the worker route's maxDuration, which is also the generate route's), so a
 * second worker can never steal a job whose first worker is still generating
 * and mark it finished over that worker's head.
 */
export const JOB_LEASE_SECONDS = GENERATE_ROUTE_MAX_DURATION_SECONDS;

/** How often a long step renews the job lease (and notices a cancel). */
export const HEARTBEAT_MS = 10_000;

/** Below this much time left, a model call is not started: fail fast, retryable. */
export const MIN_MODEL_CALL_MS = 10_000;

/** The worker will not start a generate wave with less than this before its hard deadline. */
export const GENERATION_MIN_WINDOW_MS = 120_000;

/** Transient provider failures (429/5xx/529, connection drops) get another try inside the same deadline. */
export const GENERATION_RETRY: RetryPolicy = { attempts: 3, baseDelayMs: 2_000, maxDelayMs: 10_000 };

export function remainingModelCallMs(deadlineAt: number, now: number): number {
  return Math.max(0, deadlineAt - now);
}
