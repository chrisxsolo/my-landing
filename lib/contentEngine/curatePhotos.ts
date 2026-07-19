// AI curation service: one text-only model call over the analyzed photo
// summaries picks the top `count` photos; every other analyzed photo is
// bulk-excluded (the admin can re-Include any of them from the grid).
// Validation is all-or-nothing — a malformed pick list excludes NOTHING.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { buildTopPicksPrompt, type PhotoSummary } from "@/lib/contentEngine/prompts";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";

export interface CuratePhotosArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  sessionId: string;
  count?: number;
  model?: string;
}

export interface CuratePhotosResult {
  curated: boolean; // false = pool already <= count, nothing was excluded
  total: number; // analyzed, included photos considered
  picked: number;
  excluded: number; // newly excluded by this pass
}

const picksSchema = z.object({ picks: z.array(z.uuid()).min(1) });

function validatePicks(text: string, candidateIds: string[], count: number): string[] {
  const parsed = picksSchema.safeParse(extractJsonObject(text));
  if (!parsed.success) {
    throw new Error(`curation schema validation failed: ${parsed.error.message}`);
  }
  const candidates = new Set(candidateIds);
  const picks = [...new Set(parsed.data.picks)];
  for (const id of picks) {
    if (!candidates.has(id)) throw new Error(`unknown session_photo_id in picks: ${id}`);
  }
  if (picks.length !== count) {
    throw new Error(`model picked ${picks.length} photo(s), expected exactly ${count}`);
  }
  return picks;
}

async function loadCandidates(client: SupabaseClient, sessionId: string): Promise<PhotoSummary[]> {
  const { data, error } = await client
    .from("session_photos")
    .select("id,alt_text,title,description,tags,quality_score,suggested_category")
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .eq("analysis_status", "completed")
    .order("quality_score", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`could not load analyzed photos: ${error.message}`);
  return (data ?? []).map((r) => ({
    session_photo_id: r.id as string,
    alt_text: r.alt_text, title: r.title, description: r.description,
    tags: (r.tags ?? []) as string[], quality_score: r.quality_score,
    suggested_category: r.suggested_category,
  }));
}

export async function curateTopPicks(args: CuratePhotosArgs): Promise<CuratePhotosResult> {
  const { client, callModel, sessionId } = args;
  const count = args.count ?? TOP_PICK_COUNT;
  const model = args.model ?? DEFAULT_ENGINE_MODEL;

  const { data: session, error: sErr } = await client
    .from("photography_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (sErr) throw new Error(`session lookup failed: ${sErr.message}`);
  if (!session) throw new Error("photography session not found");
  if (!session.ai_processing_allowed) {
    throw new Error("ai processing is not allowed for this session");
  }

  const summaries = await loadCandidates(client, sessionId);
  if (summaries.length <= count) {
    return { curated: false, total: summaries.length, picked: summaries.length, excluded: 0 };
  }

  const facts = buildSessionFactsSnapshot(session);
  const prompt = buildTopPicksPrompt(facts, summaries, count);
  const response = await callModel({
    model,
    system: prompt.system,
    maxTokens: 2000,
    messages: [{ role: "user", content: prompt.userText }],
  });

  const candidateIds = summaries.map((s) => s.session_photo_id);
  const picks = new Set(validatePicks(response.text, candidateIds, count));
  const excludeIds = candidateIds.filter((id) => !picks.has(id));

  const { error: uErr } = await client
    .from("session_photos").update({ excluded: true }).in("id", excludeIds);
  if (uErr) throw new Error(`could not exclude unpicked photos: ${uErr.message}`);

  return { curated: true, total: summaries.length, picked: picks.size, excluded: excludeIds.length };
}
