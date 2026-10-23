// The steps of a content run, one per job phase. Each step is one bounded unit
// of work over an existing engine service — all individually atomic and
// idempotent — and returns where the job goes next. jobRunner.ts owns the
// claim, the lease, the budget and the loop that calls these.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { ANALYSIS_CONCURRENCY, runAnalysis } from "@/lib/contentEngine/analyzePhotos";
import { curateTopPicks } from "@/lib/contentEngine/curatePhotos";
import { generateContentType, GenerationConflictError } from "@/lib/contentEngine/generateContent";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import {
  GENERATION_ORDER, nextGenerationType, settledGenerationCount,
  type GenerationProgressMap,
} from "@/lib/contentEngine/generationProgress";
import type { ContentEngineJob, JobPhase, WorkerContext } from "@/lib/contentEngine/jobRunner";

// When every remaining photo is leased by someone else (the admin's Analyze
// button), wait this long before looking again instead of spinning steps.
const IN_FLIGHT_WAIT_MS = 5_000;

/** Per-invocation knobs a step needs beyond the shared context. */
export interface StepEnv {
  stopClaimingAt: number;
  hardDeadlineAt: number;
  /** True once the job was cancelled or its lease lost; also renews the lease. */
  shouldStop: () => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
}

/** The outcome of one step: where the job goes next and what to record. */
export interface StepResult {
  phase: JobPhase;
  patch?: Partial<Record<"package_id" | "photos_total" | "photos_done" | "types_total" | "types_done", unknown>>;
  softError?: string;
  /** Stops the run and marks it failed — the admin has something to fix. */
  fatal?: string;
  /** Pass over this content type for the rest of the invocation. */
  skipType?: string;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface PhotoCounts { included: number; analyzed: number; failed: number }

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
    failed: rows.filter((r) => r.analysis_status === "failed").length,
  };
}

async function analyzeStep(
  ctx: WorkerContext, job: ContentEngineJob, env: StepEnv,
): Promise<StepResult> {
  const before = await photoCounts(ctx.client, job.photography_session_id);
  if (before.included === 0) {
    return { phase: "analyze", fatal: "no included photos — upload photos before running" };
  }

  const result = await runAnalysis({
    client: ctx.client, callModel: ctx.callModel, sessionId: job.photography_session_id,
    concurrency: ANALYSIS_CONCURRENCY,
    stopClaimingAt: env.stopClaimingAt,
    hardDeadlineAt: env.hardDeadlineAt,
    // A photo that fails in this run is retried (with backoff) inside its own
    // call, then left for the admin — never re-claimed by a later step.
    attemptedSince: job.started_at,
    shouldStop: env.shouldStop,
  });
  const after = await photoCounts(ctx.client, job.photography_session_id);
  const patch = { photos_total: after.included, photos_done: after.analyzed };

  if (result.remaining > 0) {
    if (result.claimed === 0 && result.inFlightElsewhere > 0) await env.sleep(IN_FLIGHT_WAIT_MS);
    return { phase: "analyze", patch };
  }
  if (after.analyzed === 0) {
    const reason = result.errors[0] ? `: ${result.errors[0]}` : "";
    return { phase: "analyze", patch, fatal: `every photo failed analysis${reason} — retry them in the Photos section` };
  }
  // One bad photo must not cost the whole shoot: carry on with the rest and
  // tell the admin which to retry.
  return {
    phase: "curate", patch,
    softError: after.failed > 0
      ? `${after.failed} photo(s) failed analysis — retry them in the Photos section`
      : undefined,
  };
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

export async function executeStep(
  ctx: WorkerContext, job: ContentEngineJob, skip: ReadonlySet<string>, env: StepEnv,
): Promise<StepResult> {
  switch (job.phase) {
    case "analyze": return analyzeStep(ctx, job, env);
    case "curate": return curateStep(ctx, job);
    case "package": return packageStep(ctx, job);
    case "generate": return generateStep(ctx, job, skip);
    case "done": return { phase: "done" };
  }
}
