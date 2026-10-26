// Runs AI vision for photos that still need it, and stores the result in
// photo_tag_reviews. Server-only.
//
// Efficient and safe to retry:
//   · only photos missing an important field with no high-confidence answer
//   · a photo is analyzed once per input (hash of what was asked); repeat
//     calls skip it unless `force`
//   · a few photos per request; the admin client loops until done, so an
//     interrupted run simply resumes where it stopped
// Originals are only read (downscaled copies are sent), never modified.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import { downloadOriginal, encodeImageForModel, toImageBlock } from "@/lib/contentEngine/modelImages";
import type { KnownPlace } from "@/lib/locations/places";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { saveVisionSuggestions } from "@/lib/photoTagging/reviews";
import { buildVisionPrompt, parseVisionReply, VISION_PROMPT_VERSION, type VisionRequest } from "@/lib/photoTagging/visionPrompt";

export const VISION_BATCH_MAX = 4;
const VISION_TIMEOUT_MS = 60_000;
const MODEL_FETCH_WIDTH = 1600;

/** The fields vision could still help with, or [] when the photo doesn't need it. */
export function visionRequestFor(entry: LibraryEntry): VisionRequest {
  const { photo } = entry;
  const high = new Set(photo.suggestions.filter((s) => s.confidence === "high").map((s) => s.field));
  const missing = photo.checks
    .filter((c) => c.state === "missing" && c.field !== "category" && !high.has(c.field))
    .map((c) => c.field);
  return { category: photo.category, school: photo.school, missing };
}

export function visionInputHash(entry: LibraryEntry, req: VisionRequest): string {
  return createHash("sha256").update(JSON.stringify({
    v: VISION_PROMPT_VERSION, key: entry.photo.key, image: entry.vision.imageUrl ?? entry.vision.storagePath,
    category: req.category, school: req.school, missing: [...req.missing].sort(),
  })).digest("hex").slice(0, 32);
}

/** Whether a photo should be sent (missing fields, an image, not already asked the same question). */
export function needsVision(entry: LibraryEntry, storedHash: string | null, force: boolean): boolean {
  const req = visionRequestFor(entry);
  if (req.missing.length === 0) return false;
  if (!entry.vision.imageUrl && !entry.vision.storagePath) return false;
  return force || storedHash !== visionInputHash(entry, req);
}

// Public Storage objects are fetched through Supabase's resize endpoint so a
// 30 MB portfolio original never crosses the wire; anything else as-is.
function smallerUrl(url: string): string {
  if (!url.includes("/storage/v1/object/public/")) return url;
  const resized = new URL(url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/"));
  resized.searchParams.set("width", String(MODEL_FETCH_WIDTH));
  resized.searchParams.set("resize", "contain");
  return resized.toString();
}

async function imageBuffer(client: SupabaseClient, entry: LibraryEntry): Promise<Buffer> {
  if (entry.vision.storagePath && !entry.vision.imageUrl) return downloadOriginal(client, entry.vision.storagePath);
  const url = entry.vision.imageUrl as string;
  for (const candidate of [smallerUrl(url), url]) {
    const res = await fetch(candidate);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`could not fetch ${url}`);
}

export interface VisionOutcome { key: string; suggestions: number; error: string | null }

export async function runVision(
  client: SupabaseClient, caller: ModelCaller, entry: LibraryEntry, places: readonly KnownPlace[],
): Promise<VisionOutcome> {
  const req = visionRequestFor(entry);
  try {
    const encoded = await encodeImageForModel(await imageBuffer(client, entry));
    const prompt = buildVisionPrompt(req, places);
    const reply = await caller({
      model: DEFAULT_ENGINE_MODEL, system: prompt.system, maxTokens: 500, timeoutMs: VISION_TIMEOUT_MS, maxRetries: 1,
      messages: [{ role: "user", content: [toImageBlock(encoded), { type: "text", text: prompt.text }] }],
    });
    let parsed: unknown = null;
    try { parsed = extractJsonObject(reply.text); } catch { parsed = null; }
    const suggestions = parseVisionReply(parsed, req, places);
    await saveVisionSuggestions(client, entry.photo.key, suggestions, visionInputHash(entry, req), reply.model);
    return { key: entry.photo.key, suggestions: suggestions.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[photo-tagging] vision failed", entry.photo.key, message);
    return { key: entry.photo.key, suggestions: 0, error: message };
  }
}
