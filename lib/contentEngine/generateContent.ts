// Generation orchestrator (spec §8.2): atomic per-type claim → target → insert
// validated drafts (idempotency-keyed, retry-safe) → record result + usage
// atomically with that type's progress (spec §11). Everything after the claim
// — the package lookup included — is inside the boundary that records
// 'failed' with a safe error, so a claimed type is never left `processing`
// for its lease to expire; the drafts of other types are untouched.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { buildIdempotencyKey } from "@/lib/contentEngine/idempotency";
import { sessionFactsSnapshotSchema } from "@/lib/contentEngine/payloads";
import {
  GENERATION_TARGETS, GenerationError, type ItemSpec, type TargetContext,
} from "@/lib/contentEngine/generationTargets";
import { GenerationTimeoutError } from "@/lib/contentEngine/generationTargetCore";
import { isTransientModelError } from "@/lib/contentEngine/modelRetry";
import { GENERATION_DEADLINE_MS, GENERATION_LEASE_SECONDS } from "@/lib/contentEngine/generationBudget";

export class GenerationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationConflictError";
  }
}

export interface GenerateTypeArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  packageId: string;
  contentType: string;
  model?: string;
  /**
   * Epoch ms by which model work must end — the caller's own deadline (the
   * route's budget, the worker's hard deadline). Defaults to one full
   * generation budget from now, which is still inside the claim lease.
   */
  deadlineAt?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type GenerationFailureKind = "timeout" | "model_transient" | "other";

/** Why a type was recorded failed, and whether a plain retry is worth it. */
export interface GenerationFailure {
  kind: GenerationFailureKind;
  retryable: boolean;
}

export interface GenerateTypeResult {
  outcome: "completed" | "skipped" | "failed";
  itemIds: string[];
  packageStatus: string;
  error?: string;
  failure?: GenerationFailure;
  /**
   * True when the failure could not be written to the package: the type is
   * still `processing` on its lease, and the lease-aware UI recovers it.
   */
  unrecorded?: true;
}

function classifyFailure(err: unknown): GenerationFailure {
  if (err instanceof GenerationTimeoutError) return { kind: "timeout", retryable: true };
  if (isTransientModelError(err)) return { kind: "model_transient", retryable: true };
  return { kind: "other", retryable: false };
}

async function insertDraftItems(
  ctx: TargetContext, specs: ItemSpec[], model: string,
): Promise<string[]> {
  if (specs.length === 0) return [];
  const rows = specs.map((s) => ({
    package_id: ctx.packageId,
    content_type: s.content_type,
    status: "draft",
    payload: s.payload,
    generation_model: model,
    prompt_version: PROMPT_VERSION,
    generated_at: new Date().toISOString(),
    idempotency_key: buildIdempotencyKey({
      sessionId: ctx.sessionId, packageId: ctx.packageId, contentType: s.content_type,
      destination: s.destination, photoId: s.photoId,
    }),
  }));
  const { data, error } = await ctx.client
    .from("session_content_items")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new GenerationError(`could not insert draft items: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

export async function generateContentType(args: GenerateTypeArgs): Promise<GenerateTypeResult> {
  const { client, callModel, packageId, contentType } = args;
  const now = args.now ?? Date.now;
  const startedAt = now();
  const deadlineAt = args.deadlineAt ?? startedAt + GENERATION_DEADLINE_MS;

  // The lease outlives any invocation that could still write this type
  // (generationBudget): a live claim is never reclaimed, an expired one always is.
  const { data: claimed, error: claimErr } = await client.rpc("claim_generation_type", {
    p_package_id: packageId, p_content_type: contentType, p_lease_seconds: GENERATION_LEASE_SECONDS,
  });
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed) {
    throw new GenerationConflictError(
      `content type ${contentType} is already in progress or terminal for this package`,
    );
  }

  try {
    const { data: pkg, error: pkgErr } = await client
      .from("session_content_packages")
      .select("photography_session_id,model_name,session_facts_snapshot,generation_settings")
      .eq("id", packageId).single();
    if (pkgErr || !pkg) throw new Error(`package lookup failed: ${pkgErr?.message ?? "missing"}`);

    const model = args.model
      ?? (pkg.generation_settings?.overrides?.model_name as string | undefined)
      ?? (pkg.model_name as string | undefined)
      ?? DEFAULT_ENGINE_MODEL;
    const facts = sessionFactsSnapshotSchema.parse(pkg.session_facts_snapshot);
    const target = GENERATION_TARGETS[contentType];
    if (!target) throw new GenerationError(`content type ${contentType} is not generatable`);

    const ctx: TargetContext = {
      client, callModel, model,
      sessionId: pkg.photography_session_id as string,
      packageId, facts,
      deadlineAt, now, sleep: args.sleep,
    };
    const result = await target(ctx);
    const itemIds = await insertDraftItems(ctx, result.itemSpecs, model);

    const { data: status, error: recErr } = await client.rpc("record_generation_result", {
      p_package_id: packageId, p_content_type: contentType,
      p_outcome: result.outcome, p_error: null, p_usage: result.usage,
    });
    if (recErr) throw new Error(`could not record generation result: ${recErr.message}`);
    return { outcome: result.outcome, itemIds, packageStatus: status as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failure = classifyFailure(err);
    // Safe to log: ids, timing and the error class — never a prompt or a draft.
    console.warn(
      `[content-engine] ${contentType} failed for package ${packageId}: ${failure.kind}` +
      `${failure.retryable ? " (retryable)" : ""} after ${now() - startedAt}ms, ` +
      `${deadlineAt - now()}ms before the deadline`,
    );
    const { data: status, error: recErr } = await client.rpc("record_generation_result", {
      p_package_id: packageId, p_content_type: contentType,
      p_outcome: "failed", p_error: message, p_usage: null,
    });
    if (recErr) {
      // Distinct from a recorded failure: the type is still `processing` on its
      // lease. Say so rather than report it terminal.
      console.error(`[content-engine] could not record the failure of ${contentType} for package ${packageId}:`, recErr.message);
      return { outcome: "failed", itemIds: [], packageStatus: "generating", error: message, failure, unrecorded: true };
    }
    return {
      outcome: "failed", itemIds: [],
      packageStatus: (status as string | null) ?? "generating", error: message, failure,
    };
  }
}
