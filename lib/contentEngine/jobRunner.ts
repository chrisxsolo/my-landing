// Background worker for content runs. Replaces the browser as the orchestrator:
// the admin enqueues a job and may close the tab, and this runs the same steps
// server-side until the drafts are ready for review.
//
// Shape of one invocation: claim a job (atomic, leased) → execute ONE step at a
// time until the time budget runs out → either finish the job or hand it back as
// 'queued' for the next invocation. Every step is an existing engine service
// (runAnalysisBatch, curateTopPicks, create_content_package, generateContentType)
// and every one of those is individually atomic and idempotent, so an invocation
// that dies anywhere is resumed by the next claim without duplicating work.
//
// What this never does: publish. A run produces drafts only; publication stays
// an explicit admin action behind marketing_permission.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { runAnalysisBatch } from "@/lib/contentEngine/analyzePhotos";
import { curateTopPicks } from "@/lib/contentEngine/curatePhotos";
import { generateContentType, GenerationConflictError } from "@/lib/contentEngine/generateContent";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import {
  GENERATION_ORDER, nextGenerationType, settledGenerationCount,
  type GenerationProgressMap,
} from "@/lib/contentEngine/generationProgress";

export const JOB_LEASE_SECONDS = 120;
export const MAX_JOB_ATTEMPTS = 5;
// Steps are inherently bounded (one analysis batch per 4 photos, one call per
// content type), so this only exists to make a pathological loop impossible.
export const MAX_JOB_STEPS = 200;
// Well inside the route's 60s maxDuration: one more step must still fit after
// the check, and a step is a single model call.
export const DEFAULT_BUDGET_MS = 40_000;

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

/** The outcome of one step: where the job goes next and what to record. */
interface StepResult {
  phase: JobPhase;
  patch?: Partial<Record<"package_id" | "photos_total" | "photos_done" | "types_total" | "types_done", unknown>>;
  softError?: string;
  /** Stops the run and marks it failed — the admin has something to fix. */
  fatal?: string;
  /** Pass over this content type for the rest of the invocation. */
  skipType?: string;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface PhotoCounts { included: number; analyzed: number; pending: number }

async function photoCounts(client: SupabaseClient, sessionId: string): Promise<PhotoCounts> {
  const { data, error } = await client
    .from("session_photos")
    .select("analysis_status")
    .eq("photography_session_id", sessionId)
    .eq("excluded", false);
  if (error) throw new Error(`could not count session photos: ${error.message}`);
  const rows = data ?? [];
  return {
    included: rows.length,
    analyzed: rows.filter((r) => r.analysis_status === "completed").length,
    pending: rows.filter((r) => r.analysis_status === "pending" || r.analysis_status === "failed").length,
  };
}

async function analyzeStep(ctx: WorkerContext, job: ContentEngineJob): Promise<StepResult> {
  const before = await photoCounts(ctx.client, job.photography_session_id);
  if (before.included === 0) {
    return { phase: "analyze", fatal: "no included photos — upload photos before running" };
  }
  if (before.pending === 0) {
    return {
      phase: "curate",
      patch: { photos_total: before.included, photos_done: before.analyzed },
    };
  }

  const result = await runAnalysisBatch({
    client: ctx.client, callModel: ctx.callModel, sessionId: job.photography_session_id,
  });
  const after = await photoCounts(ctx.client, job.photography_session_id);
  const patch = { photos_total: after.included, photos_done: after.analyzed };

  if (result.failed > 0) {
    return {
      phase: "analyze", patch,
      fatal: `${result.failed} photo(s) failed analysis — retry them in the Photos section`,
    };
  }
  return { phase: after.pending === 0 ? "curate" : "analyze", patch };
}

async function curateStep(ctx: WorkerContext, job: ContentEngineJob): Promise<StepResult> {
  const counts = await photoCounts(ctx.client, job.photography_session_id);
  if (counts.included < AUTO_CURATE_THRESHOLD) {
    return { phase: "package" };
  }
  try {
    await curateTopPicks({
      client: ctx.client, callModel: ctx.callModel, sessionId: job.photography_session_id,
    });
    const after = await photoCounts(ctx.client, job.photography_session_id);
    return { phase: "package", patch: { photos_total: after.included, photos_done: after.analyzed } };
  } catch (err) {
    // Curation only narrows the pool; a failure must not cost the whole run.
    return {
      phase: "package",
      softError: `could not pick the top ${TOP_PICK_COUNT} photos: ${message(err)}`,
    };
  }
}

async function packageStep(ctx: WorkerContext, job: ContentEngineJob): Promise<StepResult> {
  if (job.package_id) {
    return { phase: "generate" };
  }
  // Adopt the session's live package if one exists — create_content_package
  // would refuse a second one, and generating into a different package than the
  // admin is looking at would be worse than reusing this one.
  const { data: existing, error: exErr } = await ctx.client
    .from("session_content_packages")
    .select("id,generation_settings")
    .eq("photography_session_id", job.photography_session_id)
    .is("archived_at", null)
    .neq("status", "archived")
    .order("generation_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exErr) return { phase: "package", fatal: `package lookup failed: ${exErr.message}` };
  if (existing) {
    const selected = (existing.generation_settings?.selected_types ?? []) as string[];
    return {
      phase: "generate",
      patch: { package_id: existing.id as string, types_total: selected.length },
    };
  }

  const { data: session, error: sErr } = await ctx.client
    .from("photography_sessions").select("*").eq("id", job.photography_session_id).maybeSingle();
  if (sErr || !session) {
    return { phase: "package", fatal: `session lookup failed: ${sErr?.message ?? "not found"}` };
  }
  let snapshot;
  try {
    snapshot = buildSessionFactsSnapshot(session);
  } catch {
    return { phase: "package", fatal: "session facts are incomplete (service_type missing or invalid)" };
  }

  const { data: packageId, error } = await ctx.client.rpc("create_content_package", {
    p_session_id: job.photography_session_id,
    p_model_name: DEFAULT_ENGINE_MODEL,
    p_prompt_version: PROMPT_VERSION,
    p_selected_types: [...GENERATION_ORDER],
    p_session_facts: snapshot,
    p_generation_settings: {},
    p_archive_current: false,
    p_copy_items: [],
  });
  if (error) return { phase: "package", fatal: `could not create the content package: ${error.message}` };
  return {
    phase: "generate",
    patch: { package_id: packageId as string, types_total: GENERATION_ORDER.length },
  };
}

async function generateStep(
  ctx: WorkerContext, job: ContentEngineJob, skip: ReadonlySet<string>,
): Promise<StepResult> {
  if (!job.package_id) return { phase: "package" };

  const { data: pkg, error } = await ctx.client
    .from("session_content_packages")
    .select("generation_settings")
    .eq("id", job.package_id).maybeSingle();
  if (error || !pkg) {
    return { phase: "generate", fatal: `package lookup failed: ${error?.message ?? "not found"}` };
  }
  const selected = (pkg.generation_settings?.selected_types ?? []) as string[];
  const progress = (pkg.generation_settings?.progress ?? {}) as GenerationProgressMap;
  const settled = settledGenerationCount(selected, progress);
  const counters = { types_total: selected.length, types_done: settled };

  const contentType = nextGenerationType(selected, progress, { skip });
  if (!contentType) return { phase: "done", patch: counters };

  try {
    const result = await generateContentType({
      client: ctx.client, callModel: ctx.callModel,
      packageId: job.package_id, contentType,
    });
    return {
      phase: "generate", patch: counters,
      // A failed type is recorded on the package with its own error; the run
      // carries on and the admin can retry or skip that one type by hand.
      softError: result.outcome === "failed"
        ? `${contentType}: ${result.error ?? "generation failed"}`
        : undefined,
    };
  } catch (err) {
    if (err instanceof GenerationConflictError) {
      // Someone (or a previous invocation whose lease is still live) holds this
      // type. Leave it to them and move on.
      return { phase: "generate", patch: counters, skipType: contentType };
    }
    return { phase: "generate", patch: counters, fatal: message(err) };
  }
}

async function executeStep(
  ctx: WorkerContext, job: ContentEngineJob, skip: ReadonlySet<string>,
): Promise<StepResult> {
  switch (job.phase) {
    case "analyze": return analyzeStep(ctx, job);
    case "curate": return curateStep(ctx, job);
    case "package": return packageStep(ctx, job);
    case "generate": return generateStep(ctx, job, skip);
    case "done": return { phase: "done" };
  }
}

export interface RunWorkerArgs extends WorkerContext {
  budgetMs?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
  /** Injectable clock so tests don't wait out a real budget. */
  now?: () => number;
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

  // Writes progress and renews the lease in one statement. The status guard is
  // how cancellation lands: if the row is no longer 'running' (cancelled by the
  // admin, or stolen after a lease expiry) the write matches nothing and we stop.
  const writeProgress = async (
    next: ContentEngineJob, result: StepResult,
  ): Promise<ContentEngineJob | null> => {
    const softErrors = result.softError
      ? [...next.soft_errors, result.softError].slice(-20)
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
      step = await executeStep(ctx, job, skip);
    } catch (err) {
      // An unexpected throw is still the admin's problem to see, not a silent
      // stall: record it and let attempts/lease recovery handle a flake.
      await finish("failed", message(err));
      return result({ status: "failed", phase: "done" });
    }

    if (step.skipType) skip.add(step.skipType);

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
