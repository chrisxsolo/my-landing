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
import { findSchool } from "@/lib/contentEngine/schoolStore";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import {
  GENERATION_ORDER, JOURNAL_DEPENDENCIES, journalReady, nextGenerationWave, settledGenerationCount,
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
  softErrors?: string[];
  /** Stops the run and marks it failed — the admin has something to fix. */
  fatal?: string;
  /** Pass over these content types for the rest of the invocation. */
  skipTypes?: string[];
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
    softErrors: after.failed > 0
      ? [`${after.failed} photo(s) failed analysis — retry them in the Photos section`]
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
      softErrors: [`could not pick the top ${TOP_PICK_COUNT} photos: ${message(err)}`],
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
  // A failed lookup throws and is recorded on the job, not reported as bad facts.
  const school = typeof session.school_slug === "string"
    ? await findSchool(ctx.client, session.school_slug) : null;
  let snapshot;
  try {
    snapshot = buildSessionFactsSnapshot(session, school);
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

interface PackageProgress { selected: string[]; progress: GenerationProgressMap }

async function loadPackageProgress(ctx: WorkerContext, packageId: string): Promise<PackageProgress | string> {
  const { data: pkg, error } = await ctx.client
    .from("session_content_packages")
    .select("generation_settings")
    .eq("id", packageId).maybeSingle();
  if (error || !pkg) return `package lookup failed: ${error?.message ?? "not found"}`;
  return {
    selected: (pkg.generation_settings?.selected_types ?? []) as string[],
    progress: (pkg.generation_settings?.progress ?? {}) as GenerationProgressMap,
  };
}

type TypeOutcome = { softError?: string; skipType?: string; fatal?: string };

async function generateOneType(ctx: WorkerContext, packageId: string, contentType: string): Promise<TypeOutcome> {
  try {
    const result = await generateContentType({
      client: ctx.client, callModel: ctx.callModel, packageId, contentType,
    });
    // A failed type is recorded on the package with its own error; the run
    // carries on and the admin can retry or skip that one type by hand.
    return result.outcome === "failed"
      ? { softError: `${contentType}: ${result.error ?? "generation failed"}` }
      : {};
  } catch (err) {
    // Someone (or a previous invocation whose lease is still live) holds this
    // type. Leave it to them and move on.
    if (err instanceof GenerationConflictError) return { skipType: contentType };
    return { fatal: message(err) };
  }
}

/**
 * Writes the journal post once its inputs are, without waiting for the
 * unrelated types still running beside it. Re-reads progress so a link or
 * testimonial draft that failed (and is due a retry) holds the journal back.
 */
async function journalAfter(
  ctx: WorkerContext, packageId: string, inputs: Promise<TypeOutcome[]>, skip: ReadonlySet<string>,
): Promise<TypeOutcome[]> {
  await inputs;
  const now = await loadPackageProgress(ctx, packageId);
  if (typeof now === "string" || !journalReady(now.selected, now.progress, { skip })) return [];
  return [await generateOneType(ctx, packageId, "journal_post")];
}

/**
 * Generates content types side by side. Every independent type starts at
 * once; the journal post starts the moment its link and testimonial inputs
 * are written, overlapping the slower portfolio/school/guide picks.
 * claim_generation_type is atomic per type, so concurrent types never collide
 * and a replayed type is a no-op.
 */
async function generateStep(
  ctx: WorkerContext, job: ContentEngineJob, skip: ReadonlySet<string>,
): Promise<StepResult> {
  if (!job.package_id) return { phase: "package" };
  const packageId = job.package_id;
  const before = await loadPackageProgress(ctx, packageId);
  if (typeof before === "string") return { phase: "generate", fatal: before };

  const wave = nextGenerationWave(before.selected, before.progress, { skip });
  if (wave.length === 0) {
    return {
      phase: "done",
      patch: { types_total: before.selected.length, types_done: settledGenerationCount(before.selected, before.progress) },
    };
  }

  const isInput = (t: string) => JOURNAL_DEPENDENCIES.includes(t);
  const inputs = Promise.all(wave.filter(isInput).map((t) => generateOneType(ctx, packageId, t)));
  const others = Promise.all(wave.filter((t) => !isInput(t)).map((t) => generateOneType(ctx, packageId, t)));
  const journalPending = before.selected.includes("journal_post") && !wave.includes("journal_post");
  const journal = journalPending ? journalAfter(ctx, packageId, inputs, skip) : Promise.resolve([]);
  const outcomes = (await Promise.all([inputs, others, journal])).flat();

  const after = await loadPackageProgress(ctx, packageId);
  return {
    phase: "generate",
    patch: typeof after === "string" ? undefined
      : { types_total: after.selected.length, types_done: settledGenerationCount(after.selected, after.progress) },
    softErrors: outcomes.flatMap((o) => (o.softError ? [o.softError] : [])),
    skipTypes: outcomes.flatMap((o) => (o.skipType ? [o.skipType] : [])),
    fatal: outcomes.find((o) => o.fatal)?.fatal,
  };
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
