// Foreground helpers for the manual, per-step buttons in the workspace: the
// Analyze run in PhotosSection and the Generate wave in GenerationSection.
//
// A WHOLE run is not orchestrated here any more — that moved to the background
// worker (lib/contentEngine/jobRunner.ts) so a run survives the tab closing.
// Every step is an existing engine route and every route claims atomically
// (claim_photos_for_analysis uses FOR UPDATE SKIP LOCKED; claim_generation_type
// is per-type), so a re-run always picks up whatever is left.
import { engineApi } from "./engineApi";
import { pendingGenerationTypesFrom } from "@/lib/contentEngine/generationProgress";
import type { PhotoStatusRow } from "@/lib/contentEngine/jobProgress";
import {
  CONTENT_TYPE_LABELS, type EnginePackage, type EnginePhoto,
} from "./engineTypes";

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
  /** Called after each round commits, for incremental UI refreshes. */
  onRound?: () => void;
  /** Called once the first round reports when this run started. */
  onRunStarted?: (runStartedAt: string) => void;
  /** Waits between rounds while another worker holds the remaining photos. */
  sleep?: (ms: number) => Promise<void>;
}

export interface AnalyzeAllResult {
  completed: number;
  failed: number;
  errors: string[];
}

// A round analyzes photos in parallel on the server for up to ~50s, so a
// 50-photo shoot is one or two rounds. The cap only stops a pathological loop.
const MAX_ANALYZE_ROUNDS = 30;
const IN_FLIGHT_WAIT_MS = 3_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Drives analysis to completion, one server round at a time — the server runs
 * the photos concurrently. A photo that fails is retried (with backoff) inside
 * its round and then left alone for the rest of this run, so one bad photo
 * neither stops the others nor loops; the admin retries it explicitly.
 */
export async function analyzeAllPhotos(
  sessionId: string, options: AnalyzeAllOptions = {},
): Promise<AnalyzeAllResult> {
  const sleep = options.sleep ?? wait;
  let runStartedAt: string | null = null;
  let completed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let round = 0; round < MAX_ANALYZE_ROUNDS; round++) {
    const result = await engineApi.analyzePhotos(sessionId, runStartedAt);
    if (runStartedAt === null) {
      runStartedAt = result.runStartedAt;
      options.onRunStarted?.(runStartedAt);
    }
    completed += result.completed;
    failed += result.failed;
    for (const e of result.errors) if (!errors.includes(e)) errors.push(e);
    options.onRound?.();
    if (result.remaining === 0) break;
    if (result.claimed === 0) {
      // The rest belong to someone else (a background run): wait them out.
      if (result.inFlightElsewhere === 0) break;
      await sleep(IN_FLIGHT_WAIT_MS);
    }
  }
  return { completed, failed, errors };
}

/**
 * Folds live analysis statuses into the photo list without refetching it — a
 * refetch re-signs every thumbnail and makes the browser reload the grid.
 * Returns the same array when nothing changed, so React skips the render.
 */
export function mergePhotoStatuses(
  photos: EnginePhoto[], statuses: readonly PhotoStatusRow[],
): EnginePhoto[] {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  let changed = false;
  const next = photos.map((photo) => {
    const s = byId.get(photo.id);
    if (!s) return photo;
    const status = s.analysis_status as EnginePhoto["analysis_status"];
    if (photo.analysis_status === status && photo.quality_score === s.quality_score
      && photo.analysis_error === s.analysis_error) return photo;
    changed = true;
    return {
      ...photo, analysis_status: status, quality_score: s.quality_score,
      analysis_error: s.analysis_error, analysis_lease_expires_at: s.analysis_lease_expires_at,
    };
  });
  return changed ? next : photos;
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
