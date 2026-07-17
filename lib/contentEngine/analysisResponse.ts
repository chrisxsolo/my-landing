// Vision-response validation (spec §8.1 steps 3-4). The model must key results
// by session_photo_id — never array position — and identity validation
// requires every requested id EXACTLY once with no unknown/missing/duplicate
// ids. Violations fail only the affected batch.
import { z } from "zod";
import { PORTFOLIO_CATEGORIES } from "@/lib/contentEngine/taxonomy";

export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisValidationError";
  }
}

// Model text that overruns a length cap is clamped, not rejected — the model
// occasionally ignores the prompt's char limits, and failing the batch over
// prose length made those photos permanently unanalyzable. Cuts land on a word
// boundary when one exists in the tail of the allowance.
function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

const clampedText = (max: number) =>
  z.string().nullable().default("").transform((v) => (v === null ? v : clampText(v, max)));

const photoAnalysisSchema = z.object({
  session_photo_id: z.uuid(),
  alt_text: z.string().min(1).transform((v) => clampText(v, 300)),
  title: clampedText(160),
  description: clampedText(1000),
  tags: z.array(z.string()).default([])
    .transform((arr) => arr.slice(0, 15).map((t) => clampText(t, 60))),
  quality_score: z.number().int().min(1).max(10),
  suggested_category: z.enum(PORTFOLIO_CATEGORIES).nullable().default(null),
  destination_recommendations: z
    .object({
      portfolio: z.boolean().optional(),
      school_page: z.boolean().optional(),
      guide: z.boolean().optional(),
      journal: z.boolean().optional(),
    })
    .nullable()
    .default(null),
});
export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;

export const analysisResponseSchema = z.object({
  photos: z.array(photoAnalysisSchema).min(1),
});

// Pull the first {...} object out of model text (tolerates prose/code fences).
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AnalysisValidationError("model response contains no JSON object");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new AnalysisValidationError(`model response is not valid JSON: ${String(err)}`);
  }
}

export function validateAnalysisResponse(text: string, expectedIds: string[]): PhotoAnalysis[] {
  const parsed = analysisResponseSchema.safeParse(extractJsonObject(text));
  if (!parsed.success) {
    throw new AnalysisValidationError(`analysis schema validation failed: ${parsed.error.message}`);
  }
  const photos = parsed.data.photos;

  const expected = new Set(expectedIds);
  const seen = new Set<string>();
  for (const p of photos) {
    if (!expected.has(p.session_photo_id)) {
      throw new AnalysisValidationError(`unknown session_photo_id in response: ${p.session_photo_id}`);
    }
    if (seen.has(p.session_photo_id)) {
      throw new AnalysisValidationError(`duplicate session_photo_id in response: ${p.session_photo_id}`);
    }
    seen.add(p.session_photo_id);
  }
  for (const id of expected) {
    if (!seen.has(id)) {
      throw new AnalysisValidationError(`missing session_photo_id in response: ${id}`);
    }
  }
  return photos;
}
