// Analysis pipeline service (spec §8.1): claim → download → downscale → one
// vision call per batch → identity-validate → batch-atomic commit. Each call
// processes ONE batch (<=4 photos); the admin client orchestrates by calling
// repeatedly until remaining is 0 (resume-safe via leases).
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { buildAnalysisPrompt, PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { validateAnalysisResponse, type PhotoAnalysis } from "@/lib/contentEngine/analysisResponse";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/contentEngine/analysisBatching";
import {
  downloadOriginal, encodeBatchUnderCap, toImageBlock,
} from "@/lib/contentEngine/modelImages";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";

export interface AnalyzeBatchArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  sessionId: string;
  photoIds?: string[] | null;
  model?: string;
}

export interface AnalyzeBatchResult {
  claimed: number;
  completed: number;
  failed: number;
  remaining: number;
}

async function countRemaining(client: SupabaseClient, sessionId: string): Promise<number> {
  const { count } = await client
    .from("session_photos")
    .select("id", { count: "exact", head: true })
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .in("analysis_status", ["pending", "failed"]);
  return count ?? 0;
}

type ClaimedPhoto = { id: string; storage_path: string };

async function loadClaimed(client: SupabaseClient, ids: string[]): Promise<ClaimedPhoto[]> {
  const { data, error } = await client
    .from("session_photos").select("id,storage_path").in("id", ids);
  if (error) throw new Error(`could not load claimed photos: ${error.message}`);
  // preserve claim order
  const byId = new Map((data ?? []).map((r) => [r.id as string, r as ClaimedPhoto]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`claimed photo ${id} disappeared`);
    return row;
  });
}

function successResults(analyses: PhotoAnalysis[], model: string, usage: unknown, rawText: string) {
  return analyses.map((a) => ({
    session_photo_id: a.session_photo_id,
    success: true,
    analysis_model: model,
    analysis_version: PROMPT_VERSION,
    fields: {
      alt_text: a.alt_text,
      title: a.title ?? "",
      description: a.description ?? "",
      tags: a.tags,
      quality_score: a.quality_score,
      suggested_category: a.suggested_category,
      destination_recommendations: a.destination_recommendations,
    },
    payload: { raw: rawText.slice(0, 20_000), usage },
  }));
}

function failureResults(ids: string[], model: string, message: string) {
  return ids.map((id) => ({
    session_photo_id: id,
    success: false,
    error: message.slice(0, 2000),
    analysis_model: model,
    analysis_version: PROMPT_VERSION,
  }));
}

export async function runAnalysisBatch(args: AnalyzeBatchArgs): Promise<AnalyzeBatchResult> {
  const { client, callModel, sessionId } = args;
  const model = args.model ?? DEFAULT_ENGINE_MODEL;

  const { data: session, error: sErr } = await client
    .from("photography_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (sErr) throw new Error(`session lookup failed: ${sErr.message}`);
  if (!session) throw new Error("photography session not found");
  if (!session.ai_processing_allowed) {
    throw new Error("ai processing is not allowed for this session");
  }
  const facts = buildSessionFactsSnapshot(session);

  const { data: claimedIds, error: claimErr } = await client.rpc("claim_photos_for_analysis", {
    p_session_id: sessionId,
    p_photo_ids: args.photoIds ?? null,
    p_max_photos: MAX_PHOTOS_PER_BATCH,
    p_lease_seconds: 180,
  });
  if (claimErr) throw new Error(claimErr.message);
  const ids = (claimedIds ?? []) as string[];
  if (ids.length === 0) {
    return { claimed: 0, completed: 0, failed: 0, remaining: await countRemaining(client, sessionId) };
  }

  let results: Record<string, unknown>[];
  let completed = 0;
  let failed = 0;
  try {
    const photos = await loadClaimed(client, ids);
    const originals = await Promise.all(photos.map((p) => downloadOriginal(client, p.storage_path)));
    const encoded = await encodeBatchUnderCap(originals);
    const prompt = buildAnalysisPrompt(facts, ids);

    const response = await callModel({
      model,
      system: prompt.system,
      maxTokens: 4000,
      messages: [{
        role: "user",
        content: [...encoded.map(toImageBlock), { type: "text", text: prompt.userText }],
      }],
    });

    const analyses = validateAnalysisResponse(response.text, ids);
    results = successResults(analyses, response.model, response.usage, response.text);
    completed = ids.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results = failureResults(ids, model, message);
    failed = ids.length;
  }

  const { error: recordErr } = await client.rpc("record_analysis_batch", {
    p_session_id: sessionId,
    p_results: results,
  });
  if (recordErr) throw new Error(`could not record analysis batch: ${recordErr.message}`);

  return { claimed: ids.length, completed, failed, remaining: await countRemaining(client, sessionId) };
}
