// Shared plumbing for the per-type generation targets: context/result types,
// the JSON model call, photo summaries, and identity/validation guards.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelCaller, ModelCallRequest, ModelCallResult, ModelUsage } from "@/lib/contentEngine/aiClient";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import type { BuiltPrompt, PhotoSummary } from "@/lib/contentEngine/prompts";
import { validatePayload, type SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { generateMetaKeywords } from "@/lib/contentEngine/serviceKeywords";
import type { toImageBlock } from "@/lib/contentEngine/modelImages";
import type { KnownPlace } from "@/lib/locations/places";
import { withRetries } from "@/lib/contentEngine/retry";
import { isModelTimeoutError, isTransientModelError, modelRetryDelayMs } from "@/lib/contentEngine/modelRetry";
import {
  GENERATION_DEADLINE_MS, GENERATION_RETRY, MIN_MODEL_CALL_MS, remainingModelCallMs,
} from "@/lib/contentEngine/generationBudget";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** The model could not answer inside the generation deadline. Retryable by a fresh invocation. */
export class GenerationTimeoutError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "GenerationTimeoutError";
  }
}

export interface ItemSpec {
  content_type: string;
  payload: Record<string, unknown>;
  destination: string | null;
  photoId: string | null;
}

export interface TargetUsage extends ModelUsage {
  model: string;
}

export interface TargetResult {
  outcome: "completed" | "skipped";
  itemSpecs: ItemSpec[];
  usage: TargetUsage | null;
  note?: string;
}

export interface TargetContext {
  client: SupabaseClient;
  callModel: ModelCaller;
  model: string;
  sessionId: string;
  packageId: string;
  facts: SessionFactsSnapshot;
  /** Epoch ms by which every model call of this target must have returned (generationBudget). */
  deadlineAt?: number;
  /** Injectable clock, so tests never wait out a real budget. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

// Deterministic meta keywords from the approved taxonomy/facts — never
// AI-invented (spec §9.3). Service-aware routing lives in serviceKeywords;
// grads output is unchanged.
export function deterministicKeywords(facts: SessionFactsSnapshot, places?: readonly KnownPlace[]): string {
  return generateMetaKeywords(facts, places);
}

// First ~200 chars of a testimonial, cut at a word boundary.
export function excerptOf(message: string, max = 200): string {
  const trimmed = message.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

export async function loadPhotoSummaries(client: SupabaseClient, sessionId: string): Promise<PhotoSummary[]> {
  const { data, error } = await client
    .from("session_photos")
    .select("id,alt_text,title,description,tags,quality_score,suggested_category,storage_path")
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .eq("analysis_status", "completed")
    .order("quality_score", { ascending: false, nullsFirst: false });
  if (error) throw new GenerationError(`could not load analyzed photos: ${error.message}`);
  return (data ?? []).map((r) => ({
    session_photo_id: r.id as string,
    alt_text: r.alt_text, title: r.title, description: r.description,
    tags: (r.tags ?? []) as string[], quality_score: r.quality_score,
    suggested_category: r.suggested_category,
  }));
}

const seconds = (ms: number) => Math.round(ms / 1000);

type ModelCallBody = Pick<ModelCallRequest, "model" | "system" | "maxTokens" | "messages">;

// One attempt, given exactly the time left: the SDK's own timeout is set to
// the remainder (never its 10-minute default) and its retries are off — the
// loop around this retries against the same deadline. A timeout comes back as
// GenerationTimeoutError, which is final: there is no time left to try again.
async function boundedModelCall(
  ctx: TargetContext, body: ModelCallBody, deadlineAt: number, now: () => number,
): Promise<ModelCallResult> {
  const remaining = remainingModelCallMs(deadlineAt, now());
  if (remaining < MIN_MODEL_CALL_MS) {
    throw new GenerationTimeoutError(
      `only ${seconds(remaining)}s left before the generation deadline — not enough for a model call`,
    );
  }
  try {
    return await ctx.callModel({ ...body, timeoutMs: remaining, maxRetries: 0 });
  } catch (err) {
    if (isModelTimeoutError(err)) {
      throw new GenerationTimeoutError(`model call timed out after ${seconds(remaining)}s`);
    }
    throw err;
  }
}

export async function callForJson(
  ctx: TargetContext, prompt: BuiltPrompt,
  imageBlocks: ReturnType<typeof toImageBlock>[] = [],
  maxTokens = 4000,
): Promise<{ json: unknown; usage: TargetUsage }> {
  const now = ctx.now ?? Date.now;
  const deadlineAt = ctx.deadlineAt ?? now() + GENERATION_DEADLINE_MS;
  const body: ModelCallBody = {
    model: ctx.model,
    system: prompt.system,
    maxTokens,
    messages: [{
      role: "user",
      content: imageBlocks.length
        ? [...imageBlocks, { type: "text", text: prompt.userText }]
        : prompt.userText,
    }],
  };
  const response = await withRetries(() => boundedModelCall(ctx, body, deadlineAt, now), {
    policy: GENERATION_RETRY, deadlineAt, now, sleep: ctx.sleep,
    isRetryable: isTransientModelError,
    delayFor: (err, attempt) => modelRetryDelayMs(err, attempt, GENERATION_RETRY),
  });
  return {
    json: extractJsonObject(response.text),
    usage: { model: response.model, ...response.usage },
  };
}

export function validated(contentType: string, payload: unknown): Record<string, unknown> {
  const result = validatePayload(contentType, payload);
  if (!result.success) {
    throw new GenerationError(
      `validation failed for ${contentType} (canonical lists are closed): ${result.error.message}`,
    );
  }
  return result.data as Record<string, unknown>;
}

export function assertKnownPhotos(ids: string[], known: Set<string>) {
  for (const id of ids) {
    if (!known.has(id)) throw new GenerationError(`unknown photo id from model: ${id}`);
  }
}

function placementPhotoId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as { session_photo_id?: unknown }).session_photo_id;
  return typeof id === "string" ? id.trim().toLowerCase() : null;
}

// The model copies 36-character photo ids by hand and sometimes garbles one.
// Drop just those placements instead of failing the whole step; fail only
// when the model returned placements and none of them name a real photo.
export function keepKnownPhotoPlacements(
  raws: unknown[], known: Set<string>, contentType: string,
): Record<string, unknown>[] {
  const kept: Record<string, unknown>[] = [];
  const dropped: string[] = [];
  for (const raw of raws) {
    const id = placementPhotoId(raw);
    if (id && known.has(id)) kept.push({ ...(raw as Record<string, unknown>), session_photo_id: id });
    else dropped.push(id ?? String(raw));
  }
  if (dropped.length > 0) {
    console.warn(`${contentType}: dropped ${dropped.length} placement(s) with unknown photo ids`, dropped);
  }
  if (raws.length > 0 && kept.length === 0) {
    throw new GenerationError(`every ${contentType} placement named an unknown photo id: ${dropped.join(", ")}`);
  }
  return kept;
}

