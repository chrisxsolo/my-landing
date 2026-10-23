// Vision-response validation (spec §8.1 steps 3-4). Analysis sends one photo
// per call, so identity is bound to the photo that was sent (see
// validateSinglePhotoResponse); field validation stays strict and a violation
// fails only that photo.
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

/**
 * One image in, one analysis out. With a single photo in the request there is
 * nothing to mix up, so the result is bound to the id that was sent rather
 * than the id the model echoed back — the model occasionally mistypes a
 * character of the uuid, which used to fail an otherwise perfect analysis.
 */
export function validateSinglePhotoResponse(text: string, photoId: string): PhotoAnalysis {
  const raw = extractJsonObject(text) as { photos?: unknown };
  if (!Array.isArray(raw.photos) || raw.photos.length !== 1) {
    throw new AnalysisValidationError("expected exactly one photo in the analysis response");
  }
  const entry = raw.photos[0];
  if (typeof entry !== "object" || entry === null) {
    throw new AnalysisValidationError("analysis response photo is not an object");
  }
  const bound = { photos: [{ ...entry, session_photo_id: photoId }] };
  const parsed = analysisResponseSchema.safeParse(bound);
  if (!parsed.success) {
    throw new AnalysisValidationError(`analysis schema validation failed: ${parsed.error.message}`);
  }
  return parsed.data.photos[0];
}
