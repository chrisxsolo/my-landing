// Background worker for content runs. Replaces the browser as the orchestrator:
// the admin enqueues a job and may close the tab, and this runs the same steps
// server-side until the drafts are ready for review.
//
// Shape of one invocation: claim a job (atomic, leased) → execute ONE step at a
// time until the time budget runs out → either finish the job or hand it back as
// 'queued' for the next invocation. Every step is an existing engine service
// (runAnalysis, curateTopPicks, create_content_package, generateContentType —
// see jobSteps.ts), every one individually atomic and idempotent, so an invocation
// that dies anywhere is resumed by the next claim without duplicating work.
//
// What this never does: publish. A run produces drafts only; publication stays
// an explicit admin action behind marketing_permission.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";
import { executeStep, type StepEnv, type StepResult } from "@/lib/contentEngine/jobSteps";

export const JOB_LEASE_SECONDS = 120;
// How often a long analysis step renews the job lease (and notices a cancel).
const HEARTBEAT_MS = 10_000;
export const MAX_JOB_ATTEMPTS = 5;
// Steps are inherently bounded (analysis steps end when the photos do, one
// call per content type), so this only exists to make a pathological loop
// impossible.
export const MAX_JOB_STEPS = 200;
// The worker route runs with maxDuration 300 (Fluid compute allows it on the
// Hobby plan). No new step — and no new photo — starts after DEFAULT_BUDGET_MS;
// work already in flight must end by HARD_DEADLINE_MS. The gap covers one
// generation call or one photo's model call with its retries.
export const DEFAULT_BUDGET_MS = 200_000;
export const HARD_DEADLINE_MS = 270_000;

export type JobPhase = "analyze" | "curate" | "package" | "generate" | "done";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ContentEngineJob {
  id: string;
  photography_session_id: string;
  package_id: string | null;
  status: JobStatus;
  phase: JobPhase;
  attempts: number;
  steps_run: number;
  photos_total: number;
  photos_done: number;
  types_total: number;
  types_done: number;
  soft_errors: string[];
  last_error: string | null;
  lease_expires_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export const JOB_COLUMNS =
  "id,photography_session_id,package_id,status,phase,attempts,steps_run," +
  "photos_total,photos_done,types_total,types_done,soft_errors,last_error," +
  "lease_expires_at,created_at,started_at,finished_at,updated_at";

export interface WorkerContext {
  client: SupabaseClient;
  callModel: ModelCaller;
}

export interface RunWorkerArgs extends WorkerContext {
  budgetMs?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
  /** Injectable clock so tests don't wait out a real budget. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunWorkerResult {
  /** False when the queue had nothing claimable. */
  picked: boolean;
  jobId: string | null;
  status: JobStatus | null;
  phase: JobPhase | null;
  stepsRun: number;
  /** True when work remains and another invocation should continue. */
  handedOff: boolean;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Renews the job lease at most every HEARTBEAT_MS while a long step runs and
 * reports whether the job is still ours. The status guard is the same one
 * writeProgress uses: a cancelled or stolen job matches nothing, which stops
 * the step's lanes before they claim another photo.
 */
function createHeartbeat(
  client: SupabaseClient, jobId: string, leaseSeconds: number, clock: () => number,
): () => Promise<boolean> {
  let lastBeat = clock();
  let lost = false;
  return async () => {
    if (lost) return true;
    if (clock() - lastBeat < HEARTBEAT_MS) return false;
    lastBeat = clock();
    const { data, error } = await client
      .from("content_engine_jobs")
      .update({ lease_expires_at: new Date(clock() + leaseSeconds * 1000).toISOString() })
      .eq("id", jobId)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (error) {
      // A blip is not a cancel; the next beat tries again.
      console.error(`content job ${jobId} heartbeat failed:`, error.message);
      return false;
    }
    lost = data === null;
    return lost;
  };
}

const IDLE: RunWorkerResult = {
  picked: false, jobId: null, status: null, phase: null, stepsRun: 0, handedOff: false,
};

/**
 * Claims one job and works it for as long as the budget allows. Returns
 * handedOff=true when the job still has work, which is the caller's signal to
 * invoke the worker again (the cron sweep does this too, so a dropped
 * continuation self-heals within one cron interval).
 */
export async function runWorkerOnce(args: RunWorkerArgs): Promise<RunWorkerResult> {
  const { client, callModel } = args;
  const budgetMs = args.budgetMs ?? DEFAULT_BUDGET_MS;
  const leaseSeconds = args.leaseSeconds ?? JOB_LEASE_SECONDS;
  const clock = args.now ?? Date.now;

  const { data: claimedRows, error: claimErr } = await client.rpc("claim_content_engine_job", {
    p_lease_seconds: leaseSeconds,
    p_max_attempts: args.maxAttempts ?? MAX_JOB_ATTEMPTS,
  });
  if (claimErr) throw new Error(`could not claim a content job: ${claimErr.message}`);
  const claimed = (claimedRows ?? []) as ContentEngineJob[];
  if (claimed.length === 0) return IDLE;

  let job = claimed[0];
  const ctx: WorkerContext = { client, callModel };
  const skip = new Set<string>();
  const startedAt = clock();
  let stepsThisRun = 0;
  const env: StepEnv = {
    stopClaimingAt: startedAt + budgetMs,
    hardDeadlineAt: startedAt + Math.max(budgetMs, HARD_DEADLINE_MS),
    shouldStop: createHeartbeat(client, job.id, leaseSeconds, clock),
    sleep: args.sleep ?? realSleep,
  };

  // Writes progress and renews the lease in one statement. The status guard is
  // how cancellation lands: if the row is no longer 'running' (cancelled by the
  // admin, or stolen after a lease expiry) the write matches nothing and we stop.
  const writeProgress = async (
    next: ContentEngineJob, result: StepResult,
  ): Promise<ContentEngineJob | null> => {
    const softErrors = result.softErrors?.length
      ? [...next.soft_errors, ...result.softErrors].slice(-20)
      : next.soft_errors;
    const { data, error } = await client
      .from("content_engine_jobs")
      .update({
        ...result.patch,
        phase: result.phase,
        steps_run: next.steps_run + 1,
        soft_errors: softErrors,
        lease_expires_at: new Date(clock() + leaseSeconds * 1000).toISOString(),
        updated_at: new Date(clock()).toISOString(),
      })
      .eq("id", next.id)
      .eq("status", "running")
      .select(JOB_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`could not record job progress: ${error.message}`);
    return (data as ContentEngineJob | null) ?? null;
  };

  const finish = async (status: "succeeded" | "failed", lastError?: string) => {
    await client
      .from("content_engine_jobs")
      .update({
        status, phase: "done", last_error: lastError ?? null,
        lease_expires_at: null,
        finished_at: new Date(clock()).toISOString(),
        updated_at: new Date(clock()).toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "running");
  };

  const handOff = async () => {
    await client
      .from("content_engine_jobs")
      .update({
        status: "queued", lease_expires_at: null,
        updated_at: new Date(clock()).toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "running");
  };

  const result = (over: Partial<RunWorkerResult> = {}): RunWorkerResult => ({
    picked: true, jobId: job.id, status: job.status, phase: job.phase,
    stepsRun: stepsThisRun, handedOff: false, ...over,
  });

  for (;;) {
    if (job.steps_run >= MAX_JOB_STEPS) {
      await finish("failed", `run exceeded ${MAX_JOB_STEPS} steps without finishing`);
      return result({ status: "failed", phase: "done" });
    }

    let step: StepResult;
    try {
      step = await executeStep(ctx, job, skip, env);
    } catch (err) {
      // An unexpected throw is still the admin's problem to see, not a silent
      // stall: record it and let attempts/lease recovery handle a flake.
      await finish("failed", message(err));
      return result({ status: "failed", phase: "done" });
    }

    for (const type of step.skipTypes ?? []) skip.add(type);

    const updated = await writeProgress(job, step);
    if (!updated) {
      // Cancelled by the admin, or the lease was stolen — either way, not ours.
      return result({ status: "cancelled", handedOff: false });
    }
    job = updated;
    stepsThisRun += 1;

    if (step.fatal) {
      await finish("failed", step.fatal);
      return result({ status: "failed", phase: "done" });
    }
    if (step.phase === "done") {
      await finish("succeeded");
      return result({ status: "succeeded", phase: "done" });
    }
    if (clock() - startedAt >= budgetMs) {
      await handOff();
      return result({ status: "queued", handedOff: true });
    }
  }
}
