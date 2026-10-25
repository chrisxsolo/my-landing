// Analysis pipeline service (spec §8.1): claim → download → downscale → vision
// call → validate → commit, ONE PHOTO PER MODEL CALL with several photos in
// flight at once.
//
// Why one photo per call: latency is dominated by the model writing its answer,
// and a 4-photo call writes four answers back to back (~31s measured) while a
// 1-photo call writes one (~11s). Running them side by side cut a 24-photo
// shoot from 185s to ~35s in the 2026-10-23 benchmark at equal quality, and a
// bad response now costs one photo instead of the three sharing its call.
//
// Safety comes from the database, not from this loop: claim_photos_for_analysis
// is FOR UPDATE SKIP LOCKED with a lease, so concurrent lanes (or a worker and
// the admin's Analyze button at once) always claim disjoint photos, and
// record_analysis_batch refuses a result whose lease has lapsed. Each lane
// claims lazily — one photo at a time — so a lease only starts ticking when
// work on that photo actually starts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { buildAnalysisPrompt, PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import {
  AnalysisValidationError, validateSinglePhotoResponse, type PhotoAnalysis,
} from "@/lib/contentEngine/analysisResponse";
import { downloadOriginal, encodeImageForModel, toImageBlock } from "@/lib/contentEngine/modelImages";
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { loadSessionFactsSnapshot } from "@/lib/contentEngine/schoolStore";
import {
  ANALYSIS_RETRY, isTransientModelError, modelRetryDelayMs,
} from "@/lib/contentEngine/modelRetry";
import { withRetries } from "@/lib/contentEngine/retry";

/** Photos in flight at once. Measured: 6 → 32/min, 10 → 40/min, no rate limiting. */
export const ANALYSIS_CONCURRENCY = 8;
export const PHOTO_LEASE_SECONDS = 180;
// A photo's whole budget — download, encode, model call and retries, record —
// must land inside its lease or record_analysis_batch rejects the result.
const PHOTO_BUDGET_MS = 150_000;
const MODEL_CALL_TIMEOUT_MS = 60_000;
// One analysis is ~400 output tokens; descriptions are clamped at 1000 chars.
const MAX_OUTPUT_TOKENS = 1_500;
const MAX_REPORTED_ERRORS = 5;
const DOWNLOAD_RETRY = { attempts: 2, baseDelayMs: 500, maxDelayMs: 500 };

export interface RunAnalysisArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  sessionId: string;
  photoIds?: string[] | null;
  model?: string;
  concurrency?: number;
  /** Epoch ms. A lane takes its first photo regardless, then claims nothing new after this. */
  stopClaimingAt?: number;
  /** Epoch ms. No photo's work (including retries) is allowed to run past this. */
  hardDeadlineAt?: number;
  /**
   * Run marker on the DATABASE clock (job.started_at, or analysisRunMarker()).
   * A photo that failed with analysis_started_at after it was tried in this
   * run and is left for the admin's Retry instead of looping.
   */
  attemptedSince?: string | null;
  /** Consulted before every claim; true stops new work (cancellation, lost lease). */
  shouldStop?: () => Promise<boolean>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunAnalysisResult {
  claimed: number;
  completed: number;
  failed: number;
  /** Photos this run could still analyze (not counting ones it already failed). */
  remaining: number;
  /** Photos currently leased by someone else — part of `remaining`. */
  inFlightElsewhere: number;
  errors: string[];
}

interface CandidateRow {
  id: string;
  storage_path: string;
  analysis_status: string;
  analysis_started_at: string | null;
  analysis_lease_expires_at: string | null;
}

interface Backlog {
  /** Claimable now, in claim order, with their storage paths. */
  claimable: CandidateRow[];
  inFlight: number;
}

async function loadBacklog(
  client: SupabaseClient, sessionId: string, photoIds: string[] | null,
  attemptedSince: string | null, nowMs: number,
): Promise<Backlog> {
  let query = client
    .from("session_photos")
    .select("id,storage_path,analysis_status,analysis_started_at,analysis_lease_expires_at")
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .in("analysis_status", ["pending", "failed", "processing"])
    .order("sort_order")
    .order("created_at");
  if (photoIds) query = query.in("id", photoIds);
  const { data, error } = await query;
  if (error) throw new Error(`could not load photos awaiting analysis: ${error.message}`);

  const since = attemptedSince ? Date.parse(attemptedSince) : null;
  const claimable: CandidateRow[] = [];
  let inFlight = 0;
  for (const row of (data ?? []) as CandidateRow[]) {
    if (row.analysis_status === "processing") {
      const lease = row.analysis_lease_expires_at ? Date.parse(row.analysis_lease_expires_at) : 0;
      if (lease > nowMs) inFlight += 1;
      else claimable.push(row);
    } else if (row.analysis_status === "failed" && since !== null && row.analysis_started_at
      && Date.parse(row.analysis_started_at) > since) {
      continue; // already tried in this run
    } else {
      claimable.push(row);
    }
  }
  return { claimable, inFlight };
}

/**
 * A run marker for an analysis run without a job row (the Analyze button):
 * the latest analysis start in the session, read from the database so it is
 * on the same clock as the analysis_started_at values it is compared with —
 * an app-server clock can be seconds off. Everything already failed started
 * at or before it, so a new run retries those; anything this run claims
 * starts strictly after it.
 */
export async function analysisRunMarker(client: SupabaseClient, sessionId: string): Promise<string> {
  const { data, error } = await client
    .from("session_photos")
    .select("analysis_started_at")
    .eq("photography_session_id", sessionId)
    .not("analysis_started_at", "is", null)
    .order("analysis_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`could not read the session's analysis history: ${error.message}`);
  return (data?.analysis_started_at as string | undefined) ?? new Date(0).toISOString();
}

function successResult(analysis: PhotoAnalysis, model: string, usage: unknown, rawText: string) {
  return {
    session_photo_id: analysis.session_photo_id,
    success: true,
    analysis_model: model,
    analysis_version: PROMPT_VERSION,
    fields: {
      alt_text: analysis.alt_text,
      title: analysis.title ?? "",
      description: analysis.description ?? "",
      tags: analysis.tags,
      quality_score: analysis.quality_score,
      suggested_category: analysis.suggested_category,
      destination_recommendations: analysis.destination_recommendations,
    },
    payload: { raw: rawText.slice(0, 20_000), usage },
  };
}

function failureResult(id: string, model: string, message: string) {
  return {
    session_photo_id: id,
    success: false,
    error: message.slice(0, 2000),
    analysis_model: model,
    analysis_version: PROMPT_VERSION,
  };
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface PhotoContext {
  client: SupabaseClient;
  callModel: ModelCaller;
  model: string;
  facts: SessionFactsSnapshot;
  now: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Analyzes one claimed photo. Never throws: the outcome is the record to commit. */
async function analyzeOnePhoto(
  ctx: PhotoContext, photo: CandidateRow, deadlineAt: number,
): Promise<Record<string, unknown>> {
  const retryOptions = { deadlineAt, now: ctx.now, sleep: ctx.sleep };
  try {
    // Storage hiccups are worth one more try; the bytes are reused across model retries.
    const encoded = await withRetries(
      async () => encodeImageForModel(await downloadOriginal(ctx.client, photo.storage_path)),
      { ...retryOptions, isRetryable: () => true, policy: DOWNLOAD_RETRY },
    );
    const prompt = buildAnalysisPrompt(ctx.facts, [photo.id]);
    return await withRetries(async () => {
      const response = await ctx.callModel({
        model: ctx.model,
        system: prompt.system,
        maxTokens: MAX_OUTPUT_TOKENS,
        timeoutMs: Math.min(MODEL_CALL_TIMEOUT_MS, deadlineAt - ctx.now()),
        maxRetries: 0, // retried here, against the deadline
        messages: [{
          role: "user",
          content: [toImageBlock(encoded), { type: "text", text: prompt.userText }],
        }],
      });
      const analysis = validateSinglePhotoResponse(response.text, photo.id);
      return successResult(analysis, response.model, response.usage, response.text);
    }, {
      ...retryOptions,
      policy: ANALYSIS_RETRY,
      delayFor: (err, attempt) => modelRetryDelayMs(err, attempt),
      // A malformed answer usually comes out right on a second ask.
      isRetryable: (err) => isTransientModelError(err) || err instanceof AnalysisValidationError,
    });
  } catch (err) {
    return failureResult(photo.id, ctx.model, errorMessage(err));
  }
}

async function loadFacts(client: SupabaseClient, sessionId: string): Promise<SessionFactsSnapshot> {
  const { data: session, error } = await client
    .from("photography_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`session lookup failed: ${error.message}`);
  if (!session) throw new Error("photography session not found");
  if (!session.ai_processing_allowed) {
    throw new Error("ai processing is not allowed for this session");
  }
  return loadSessionFactsSnapshot(client, session);
}

/** Shared state for the lanes of one runAnalysis call. */
interface RunState {
  args: RunAnalysisArgs;
  ctx: PhotoContext;
  byId: Map<string, CandidateRow>;
  attempted: Set<string>;
  errors: string[];
  tally: { claimed: number; completed: number; failed: number };
  stopped: boolean;
}

function recordFailure(state: RunState, message: string) {
  state.tally.failed += 1;
  if (state.errors.length < MAX_REPORTED_ERRORS && !state.errors.includes(message)) state.errors.push(message);
}

async function claimNext(state: RunState): Promise<CandidateRow | null> {
  const candidates = [...state.byId.keys()].filter((id) => !state.attempted.has(id));
  if (candidates.length === 0) return null;
  const { data, error } = await state.ctx.client.rpc("claim_photos_for_analysis", {
    p_session_id: state.args.sessionId,
    p_photo_ids: candidates,
    p_max_photos: 1,
    p_lease_seconds: PHOTO_LEASE_SECONDS,
  });
  if (error) throw new Error(error.message);
  const id = ((data ?? []) as string[])[0];
  if (!id) return null; // the rest are leased by someone else
  state.attempted.add(id);
  return state.byId.get(id) ?? null;
}

/** One lane: claim a photo, analyze it, commit it, repeat until done, stopped, or out of time. */
async function runLane(state: RunState): Promise<void> {
  const { args, ctx } = state;
  const stopClaimingAt = args.stopClaimingAt ?? Number.POSITIVE_INFINITY;
  const hardDeadlineAt = args.hardDeadlineAt ?? Number.POSITIVE_INFINITY;
  for (let taken = 0; !state.stopped; taken++) {
    if (taken > 0 && ctx.now() >= stopClaimingAt) return;
    if (args.shouldStop && await args.shouldStop()) { state.stopped = true; return; }
    const photo = await claimNext(state);
    if (!photo) return;
    state.tally.claimed += 1;

    const deadlineAt = Math.min(ctx.now() + PHOTO_BUDGET_MS, hardDeadlineAt);
    const result = await analyzeOnePhoto(ctx, photo, deadlineAt);
    const { error } = await ctx.client.rpc("record_analysis_batch", {
      p_session_id: args.sessionId, p_results: [result],
    });
    if (error) {
      // Most likely a lapsed lease: the photo becomes reclaimable on its own.
      console.error(`could not record analysis for photo ${photo.id}:`, error.message);
      recordFailure(state, `could not record analysis: ${error.message}`);
    } else if (result.success) {
      state.tally.completed += 1;
    } else {
      recordFailure(state, String(result.error));
    }
  }
}

export async function runAnalysis(args: RunAnalysisArgs): Promise<RunAnalysisResult> {
  const { client, sessionId } = args;
  const now = args.now ?? Date.now;
  const photoIds = args.photoIds ?? null;
  const attemptedSince = args.attemptedSince ?? null;
  const ctx: PhotoContext = {
    client, callModel: args.callModel, model: args.model ?? DEFAULT_ENGINE_MODEL,
    facts: await loadFacts(client, sessionId), now, sleep: args.sleep,
  };

  const backlog = await loadBacklog(client, sessionId, photoIds, attemptedSince, now());
  const state: RunState = {
    args, ctx, byId: new Map(backlog.claimable.map((row) => [row.id, row])),
    attempted: new Set(), errors: [], tally: { claimed: 0, completed: 0, failed: 0 }, stopped: false,
  };
  const lanes = Math.min(args.concurrency ?? ANALYSIS_CONCURRENCY, backlog.claimable.length);
  await Promise.all(Array.from({ length: Math.max(0, lanes) }, () => runLane(state)));

  const after = await loadBacklog(client, sessionId, photoIds, attemptedSince, now());
  // Without a run marker, photos this call just failed would read as claimable
  // again; they were attempted, so they are not "remaining" for this call.
  const remaining = after.claimable
    .filter((row) => !(row.analysis_status === "failed" && state.attempted.has(row.id))).length;
  return {
    ...state.tally,
    remaining: remaining + after.inFlight,
    inFlightElsewhere: after.inFlight,
    errors: state.errors,
  };
}
