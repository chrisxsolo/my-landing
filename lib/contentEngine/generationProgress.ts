// The generation order and the "what's left" cursor over a package's progress
// map — shared by the admin client (app/admin/content-engine/pipeline.ts) and
// the background worker (jobRunner.ts) so the two can never disagree about
// what still needs generating.
//
// Order matters: journal_post is LAST because it consumes the internal-link and
// testimonial drafts of the same package (spec §8.2 dependency graph). Walking
// this array front-to-back therefore satisfies the dependency on its own.
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

/**
 * The next type a worker should generate, or null when the run is done with
 * generation. Types that already burned their attempts are passed over so one
 * failing type can never stall the rest of the run.
 */
export function nextGenerationType(
  selectedTypes: readonly string[],
  progress: GenerationProgressMap,
  options: NextTypeOptions = {},
): string | null {
  const { skip, maxAttempts = MAX_TYPE_ATTEMPTS_PER_RUN } = options;
  for (const type of pendingGenerationTypesFrom(selectedTypes, progress)) {
    if (skip?.has(type)) continue;
    const entry = progress[type];
    if (entry?.status === "failed" && (entry.attempt ?? 0) >= maxAttempts) continue;
    return type;
  }
  return null;
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
