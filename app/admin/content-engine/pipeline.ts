// Client-side pipeline orchestration — the single source of truth for the
// "analyze → curate → package → generate" chain that used to be spread across
// PhotosSection (analysis loop) and GenerationSection (generation wave).
//
// Nothing here is new backend behaviour: every step is an existing engine route
// and every route already claims atomically (claim_photos_for_analysis uses
// FOR UPDATE SKIP LOCKED; claim_generation_type is per-type), so batches can run
// concurrently and a re-run is always safe — it picks up whatever is left.
import { engineApi } from "./engineApi";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/contentEngine/analysisBatching";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import {
  GENERATION_ORDER, CONTENT_TYPE_LABELS,
  type EnginePackage, type EnginePhoto,
} from "./engineTypes";

// Each analysis request handles one batch (<=4 photos) well inside the route's
// 60s budget, so several requests in flight shorten a 20-photo shoot from five
// serial round trips to two waves.
export const ANALYSIS_CONCURRENCY = 3;

export type PipelineStage =
  | "saving" | "analyzing" | "curating" | "packaging" | "generating" | "done";

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

export function analyzedCount(photos: EnginePhoto[]): number {
  return photos.filter((p) => !p.excluded && p.analysis_status === "completed").length;
}

/** Content types of the active package that are neither completed nor skipped. */
export function pendingGenerationTypes(pkg: EnginePackage | null): string[] {
  if (!pkg) return [];
  const progress = pkg.generation_settings.progress ?? {};
  const selected = pkg.generation_settings.selected_types ?? [];
  return GENERATION_ORDER.filter((type) => selected.includes(type)).filter((type) => {
    const entry = progress[type];
    return !!entry && entry.status !== "completed" && entry.status !== "skipped";
  });
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

export interface RunPipelineInput {
  sessionId: string;
  photos: EnginePhoto[];
  activePackage: EnginePackage | null;
  /** Commits the Session facts form so the package snapshot freezes current values. */
  flushFacts?: () => Promise<void>;
  onProgress?: ProgressReporter;
  onChanged?: () => void;
}

export interface RunPipelineResult {
  outcome: "complete" | "errors" | "aborted";
  errors: string[];
}

/** Everything between "photos are in" and "drafts are ready to review". */
export async function runFullPipeline(input: RunPipelineInput): Promise<RunPipelineResult> {
  const { sessionId, photos, activePackage, flushFacts } = input;
  const report: ProgressReporter = input.onProgress ?? (() => {});
  const changed = input.onChanged ?? (() => {});
  const errors: string[] = [];

  // Facts first: generation reads the package snapshot, so unsaved facts would
  // silently skip the guide step and force a full Regenerate later.
  if (flushFacts) {
    report({ stage: "saving", detail: "Saving session facts…" });
    try {
      await flushFacts();
    } catch (err) {
      return { outcome: "aborted", errors: [`Session facts: ${message(err)}`] };
    }
  }

  const pending = pendingAnalysisCount(photos);
  if (pending > 0) {
    report({ stage: "analyzing", detail: `Analyzing photos — 0 of ${pending} done` });
    const result = await analyzeAllPhotos(sessionId, pending, {
      onProgress: report, onBatch: changed,
    });
    if (result.failed > 0) {
      return {
        outcome: "aborted",
        errors: [`${result.failed} photo(s) failed analysis — retry them in the Photos section`],
      };
    }
  }

  const included = includedCount(photos);
  if (included === 0) {
    return { outcome: "aborted", errors: ["No included photos — upload photos first"] };
  }

  // Big shoots narrow to the strongest frames before anything is written.
  if (included >= AUTO_CURATE_THRESHOLD) {
    report({ stage: "curating", detail: `Picking the strongest ${TOP_PICK_COUNT} photos…` });
    try {
      await engineApi.curatePhotos(sessionId);
      changed();
    } catch (err) {
      errors.push(`Curation: ${message(err)}`);
    }
  }

  let packageId = activePackage?.id ?? null;
  let types = pendingGenerationTypes(activePackage);
  if (!packageId) {
    report({ stage: "packaging", detail: "Creating the content package…" });
    try {
      const created = await engineApi.createPackage(sessionId, [...GENERATION_ORDER]);
      packageId = created.packageId;
      types = [...GENERATION_ORDER];
      changed();
    } catch (err) {
      return { outcome: "aborted", errors: [`Content package: ${message(err)}`] };
    }
  }

  if (types.length > 0) {
    report({ stage: "generating", detail: `Generating ${types.length} content type(s)…` });
    errors.push(...await generateAllTypes(packageId, types, {
      onProgress: report, onTypeSettled: changed,
    }));
  }

  report({
    stage: "done",
    detail: errors.length > 0 ? "Finished with problems" : "Drafts ready for review",
  });
  return { outcome: errors.length > 0 ? "errors" : "complete", errors };
}
