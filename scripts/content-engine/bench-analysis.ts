// Benchmarks photo analysis against the real model, READ-ONLY on the database:
// it downloads originals and calls the API exactly like the engine does, but
// never claims or records anything, so it can run against an analyzed session.
//
//   npx tsx --env-file=.env.local scripts/content-engine/bench-analysis.ts \
//     <sessionId> <photoCount> [model] [concurrency]
//
// Each photo is one call at the API's native ~1.15MP size — the engine's
// production shape. (Before 2026-10-23 the engine sent 4 photos per call.)
// Writes a JSON report (timings, tokens, cost, analyses) to the scratch dir
// given by BENCH_OUT, or the working directory.
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildAnalysisPrompt } from "@/lib/contentEngine/prompts";
import { validateSinglePhotoResponse } from "@/lib/contentEngine/analysisResponse";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import {
  downloadOriginal, encodeImageForModel, toImageBlock,
} from "@/lib/contentEngine/modelImages";
import { mapWithConcurrency } from "@/lib/contentEngine/concurrency";
import { estimateCostUsd } from "@/lib/contentEngine/aiPricing";

const [sessionId, countArg, model = "claude-sonnet-4-6", concArg] = process.argv.slice(2);
if (!sessionId || !countArg) throw new Error("usage: <sessionId> <photoCount> [model] [concurrency]");
const count = Number(countArg);
const concurrency = Number(concArg ?? 6);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 3 });

interface CallRecord {
  ids: string[]; ms: number; input: number; output: number; ok: boolean; error?: string;
  limits?: Record<string, string | null>;
}

async function main() {
  const { data: session } = await db.from("photography_sessions").select("*").eq("id", sessionId).single();
  const facts = buildSessionFactsSnapshot(session);
  const { data: rows } = await db.from("session_photos")
    .select("id,storage_path,quality_score,suggested_category,tags,alt_text,description")
    .eq("photography_session_id", sessionId).eq("excluded", false)
    .order("sort_order").order("created_at").limit(count);
  const photos = rows ?? [];
  const calls: CallRecord[] = [];
  const analyses: Record<string, unknown> = {};

  const started = Date.now();
  await mapWithConcurrency(photos, concurrency, async (photo) => {
    const ids = [photo.id as string];
    const t0 = Date.now();
    try {
      const encoded = [await encodeImageForModel(await downloadOriginal(db, photo.storage_path))];
      const prompt = buildAnalysisPrompt(facts, ids);
      const { data: msg, response } = await anthropic.messages.create({
        model, max_tokens: 1500, system: prompt.system,
        messages: [{ role: "user", content: [...encoded.map(toImageBlock), { type: "text", text: prompt.userText }] }],
      }).withResponse();
      const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
      analyses[ids[0]] = validateSinglePhotoResponse(text, ids[0]);
      calls.push({
        ids, ms: Date.now() - t0, input: msg.usage.input_tokens, output: msg.usage.output_tokens, ok: true,
        limits: {
          rpm: response.headers.get("anthropic-ratelimit-requests-limit"),
          itpm: response.headers.get("anthropic-ratelimit-input-tokens-limit"),
          otpm: response.headers.get("anthropic-ratelimit-output-tokens-limit"),
        },
      });
    } catch (err) {
      calls.push({ ids, ms: Date.now() - t0, input: 0, output: 0, ok: false, error: String(err) });
    }
  });
  const totalMs = Date.now() - started;

  const ok = calls.filter((c) => c.ok);
  const analyzed = Object.keys(analyses).length;
  const cost = estimateCostUsd(ok.map((c) => ({ model, input_tokens: c.input, output_tokens: c.output })));
  const summary = {
    model, concurrency, photos: photos.length, analyzed,
    failedCalls: calls.length - ok.length,
    totalSeconds: +(totalMs / 1000).toFixed(1),
    avgCallSeconds: +(ok.reduce((s, c) => s + c.ms, 0) / Math.max(ok.length, 1) / 1000).toFixed(1),
    perPhotoWallSeconds: +(totalMs / 1000 / Math.max(analyzed, 1)).toFixed(2),
    photosPerMinute: +(analyzed / (totalMs / 60000)).toFixed(1),
    inputTokens: ok.reduce((s, c) => s + c.input, 0),
    outputTokens: ok.reduce((s, c) => s + c.output, 0),
    costUsd: +cost.totalUsd.toFixed(4),
    limits: ok[0]?.limits,
  };
  console.log(JSON.stringify(summary, null, 2));
  const out = `${process.env.BENCH_OUT ?? "."}/bench-single-${model}-c${concurrency}-${Date.now()}.json`;
  writeFileSync(out, JSON.stringify({ summary, calls, analyses, baseline: photos }, null, 2));
  console.log(`report: ${out}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
