// Shared plumbing for the per-type generation targets: context/result types,
// the JSON model call, photo summaries, and identity/validation guards.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelCaller, ModelUsage } from "@/lib/contentEngine/aiClient";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import type { BuiltPrompt, PhotoSummary } from "@/lib/contentEngine/prompts";
import { validatePayload, type SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { generateMetaKeywords } from "@/lib/contentEngine/serviceKeywords";
import type { toImageBlock } from "@/lib/contentEngine/modelImages";
import type { KnownPlace } from "@/lib/locations/places";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
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

export async function callForJson(
  ctx: TargetContext, prompt: BuiltPrompt,
  imageBlocks: ReturnType<typeof toImageBlock>[] = [],
  maxTokens = 4000,
): Promise<{ json: unknown; usage: TargetUsage }> {
  const response = await ctx.callModel({
    model: ctx.model,
    system: prompt.system,
    maxTokens,
    messages: [{
      role: "user",
      content: imageBlocks.length
        ? [...imageBlocks, { type: "text", text: prompt.userText }]
        : prompt.userText,
    }],
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

