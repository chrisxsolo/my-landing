// The generation order and the "what's left" cursor over a package's progress
// map — shared by the admin client (app/admin/content-engine/pipeline.ts) and
// the background worker (jobRunner.ts) so the two can never disagree about
// what still needs generating.
//
// Order matters: journal_post is LAST because it consumes the internal-link and
// testimonial drafts of the same package (spec §8.2 dependency graph). The
// worker runs everything else side by side and starts the journal post as soon
// as those two inputs are written (see nextGenerationWave / journalReady).
// Keep this module dependency-free — both a client component and a server
// worker import it.

export const GENERATION_ORDER = [
  "internal_link_suggestion", "testimonial_feature", "portfolio_pick",
  "school_page_photo", "guide_photo", "journal_post",
] as const;

export type GenerationType = (typeof GENERATION_ORDER)[number];

export type GenerationStatus =
  | "pending" | "processing" | "completed" | "failed" | "skipped";

export interface GenerationProgressEntry {
  status: GenerationStatus;
  attempt?: number;
  error?: string | null;
}

export type GenerationProgressMap = Record<string, GenerationProgressEntry | undefined>;

// How many times the worker will attempt one content type within a run before
// leaving it alone. The per-type Retry and Skip buttons stay available either
// way, so giving up here loses nothing but the retry loop.
export const MAX_TYPE_ATTEMPTS_PER_RUN = 2;

const TERMINAL: GenerationStatus[] = ["completed", "skipped"];

/** Selected types that are neither completed nor skipped, in generation order. */
export function pendingGenerationTypesFrom(
  selectedTypes: readonly string[], progress: GenerationProgressMap,
): string[] {
  return GENERATION_ORDER
    .filter((type) => selectedTypes.includes(type))
    .filter((type) => {
      const entry = progress[type];
      return !!entry && !TERMINAL.includes(entry.status);
    });
}

export interface NextTypeOptions {
  /** Types to pass over for now — e.g. a type another worker or tab holds. */
  skip?: ReadonlySet<string>;
  maxAttempts?: number;
}

/** Pending types a worker may attempt now, in generation order. */
function attemptableTypes(
  selectedTypes: readonly string[], progress: GenerationProgressMap, options: NextTypeOptions,
): string[] {
  const { skip, maxAttempts = MAX_TYPE_ATTEMPTS_PER_RUN } = options;
  return pendingGenerationTypesFrom(selectedTypes, progress).filter((type) => {
    if (skip?.has(type)) return false;
    const entry = progress[type];
    // Types that already burned their attempts are passed over so one failing
    // type can never stall the rest of the run.
    return !(entry?.status === "failed" && (entry.attempt ?? 0) >= maxAttempts);
  });
}

// The journal post weaves in the link and testimonial drafts of its package
// (generationTargets.journalTarget) — nothing else. It waits for these only.
export const JOURNAL_DEPENDENCIES: readonly string[] = ["internal_link_suggestion", "testimonial_feature"];

/** True when the journal post may be attempted: none of its inputs is still to be written. */
export function journalReady(
  selectedTypes: readonly string[], progress: GenerationProgressMap, options: NextTypeOptions = {},
): boolean {
  const types = attemptableTypes(selectedTypes, progress, options);
  return types.includes("journal_post") && !types.some((t) => JOURNAL_DEPENDENCIES.includes(t));
}

/**
 * The types to generate together next: every attemptable type, with the
 * journal post included only once its inputs are written. Empty when the run
 * is done with generation.
 */
export function nextGenerationWave(
  selectedTypes: readonly string[],
  progress: GenerationProgressMap,
  options: NextTypeOptions = {},
): string[] {
  const types = attemptableTypes(selectedTypes, progress, options);
  return journalReady(selectedTypes, progress, options) ? types : types.filter((t) => t !== "journal_post");
}

/** Completed or skipped count — the "4 of 6 types" numerator. */
export function settledGenerationCount(
  selectedTypes: readonly string[], progress: GenerationProgressMap,
): number {
  return selectedTypes.filter((type) => {
    const entry = progress[type];
    return !!entry && TERMINAL.includes(entry.status);
  }).length;
}
