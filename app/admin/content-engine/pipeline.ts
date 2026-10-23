// Foreground helpers for the manual, per-step buttons in the workspace: the
// Analyze run in PhotosSection and the Generate wave in GenerationSection.
//
// A WHOLE run is not orchestrated here any more — that moved to the background
// worker (lib/contentEngine/jobRunner.ts) so a run survives the tab closing.
// What stays is the shared batching: every step is an existing engine route and
// every route claims atomically (claim_photos_for_analysis uses FOR UPDATE SKIP
// LOCKED; claim_generation_type is per-type), so batches can run concurrently
// and a re-run always picks up whatever is left.
import { engineApi } from "./engineApi";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/contentEngine/analysisBatching";
import { pendingGenerationTypesFrom } from "@/lib/contentEngine/generationProgress";
import { CONTENT_TYPE_LABELS, type EnginePackage, type EnginePhoto } from "./engineTypes";

// Each analysis request handles one batch (<=4 photos) well inside the route's
// 60s budget, so several requests in flight shorten a 20-photo shoot from five
// serial round trips to two waves.
export const ANALYSIS_CONCURRENCY = 3;

export type PipelineStage = "analyzing" | "generating";

export interface PipelineProgress {
  stage: PipelineStage;
  detail: string;
}

export type ProgressReporter = (progress: PipelineProgress) => void;

const message = (err: unknown) => (err instanceof Error ? err.message : "failed");
const labelFor = (type: string) => CONTENT_TYPE_LABELS[type] ?? type;

/** Photos still awaiting (or retrying) analysis. */
export function pendingAnalysisCount(photos: EnginePhoto[]): number {
  return photos.filter(
    (p) => !p.excluded && (p.analysis_status === "pending" || p.analysis_status === "failed"),
  ).length;
}

export function includedCount(photos: EnginePhoto[]): number {
  return photos.filter((p) => !p.excluded).length;
}

/** Content types of the active package that are neither completed nor skipped. */
export function pendingGenerationTypes(pkg: EnginePackage | null): string[] {
  if (!pkg) return [];
  return pendingGenerationTypesFrom(
    pkg.generation_settings.selected_types ?? [],
    pkg.generation_settings.progress ?? {},
  );
}

export interface AnalyzeAllOptions {
  concurrency?: number;
  onProgress?: ProgressReporter;
  /** Called after each batch commits, for incremental UI refreshes. */
  onBatch?: () => void;
}

export interface AnalyzeAllResult {
  completed: number;
  failed: number;
}

/**
 * Drives analysis to completion with several batches in flight. Lanes claim
 * disjoint photos (SQL-enforced), so a lane that claims nothing simply retires
 * while its siblings finish the remainder. The first failed batch stops the run,
 * matching the previous serial behaviour (the admin then retries from Photos).
 */
export async function analyzeAllPhotos(
  sessionId: string,
  pending: number,
  options: AnalyzeAllOptions = {},
): Promise<AnalyzeAllResult> {
  const { onProgress, onBatch } = options;
  const lanes = Math.max(1, Math.min(
    options.concurrency ?? ANALYSIS_CONCURRENCY,
    Math.ceil(Math.max(pending, 1) / MAX_PHOTOS_PER_BATCH),
  ));
  let completed = 0;
  let failed = 0;
  let stop = false;

  await Promise.all(Array.from({ length: lanes }, async () => {
    while (!stop) {
      const result = await engineApi.analyzeBatch(sessionId);
      completed += result.completed;
      failed += result.failed;
      onBatch?.();
      onProgress?.({
        stage: "analyzing",
        detail: `Analyzing photos — ${Math.min(completed, pending)} of ${pending} done`,
      });
      if (result.failed > 0) { stop = true; return; }
      if (result.remaining === 0) { stop = true; return; }
      // Nothing left to claim but work remains: sibling lanes hold it.
      if (result.claimed === 0) return;
    }
  }));

  return { completed, failed };
}

export interface GenerateOptions {
  onProgress?: ProgressReporter;
  onTypeStart?: (types: string[]) => void;
  onTypeSettled?: (type: string) => void;
}

async function generateWave(
  packageId: string, types: string[], options: GenerateOptions,
): Promise<string[]> {
  if (types.length === 0) return [];
  options.onTypeStart?.(types);
  const results = await Promise.all(types.map(async (type) => {
    try {
      const result = await engineApi.generateType(packageId, type);
      return result.outcome === "failed" ? `${labelFor(type)}: ${result.error ?? "failed"}` : null;
    } catch (err) {
      return `${labelFor(type)}: ${message(err)}`;
    } finally {
      options.onTypeSettled?.(type);
    }
  }));
  return results.filter((r): r is string => r !== null);
}

/**
 * Generates the given types, independent ones concurrently. journal_post runs
 * last because it consumes the link + testimonial drafts of the same package.
 * Returns one human-readable string per failed type.
 */
export async function generateAllTypes(
  packageId: string, types: string[], options: GenerateOptions = {},
): Promise<string[]> {
  const independent = types.filter((t) => t !== "journal_post");
  const errors = await generateWave(packageId, independent, options);
  if (types.includes("journal_post")) {
    options.onProgress?.({ stage: "generating", detail: "Writing the journal post…" });
    errors.push(...await generateWave(packageId, ["journal_post"], options));
  }
  return errors;
}
