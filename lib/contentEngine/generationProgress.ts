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

// One type's entry in generation_settings.progress, as the claim/record RPCs
// write it. The lease timestamps are part of the contract: a `processing`
// entry is only "running" while its lease is live — once it lapses, the
// invocation that held it is gone (Vercel killed it) and the type is
// reclaimable, which is exactly what claim_generation_type checks.
export interface GenerationProgressEntry {
  status: GenerationStatus;
  attempt?: number;
  error?: string | null;
  usage?: { model: string; input_tokens: number; output_tokens: number } | null;
  lease_started_at?: string | null;
  lease_expires_at?: string | null;
  completed_at?: string | null;
}

/** A stored status read against the clock: `processing` splits into running and stalled. */
export type EffectiveGenerationState =
  | "pending" | "running" | "stalled" | "failed" | "completed" | "skipped";

/** The lease expiry as epoch ms, or null when it is missing or unreadable. */
export function leaseExpiresAtMs(entry: GenerationProgressEntry): number | null {
  const raw = entry.lease_expires_at;
  if (typeof raw !== "string") return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * What a progress entry means right now. `nowMs` must be the server's clock
 * (or the browser's corrected by a server offset) — the lease was written by
 * the database, and a browser running ahead would otherwise call a live claim
 * stalled. A missing or unreadable lease on a processing entry is stalled: the
 * RPC treats it as expired, and hiding it would strand the type.
 */
export function effectiveGenerationState(
  entry: GenerationProgressEntry | undefined, nowMs: number,
): EffectiveGenerationState {
  if (!entry) return "pending";
  if (entry.status !== "processing") return entry.status;
  const expiresAt = leaseExpiresAtMs(entry);
  return expiresAt !== null && expiresAt > nowMs ? "running" : "stalled";
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

/**
 * Pending types a retry may claim now: everything not terminal except a type
 * another invocation is still running. Those are left to their owner (a claim
 * would only answer 409) and picked up once the lease lapses.
 */
export function retryableGenerationTypesFrom(
  selectedTypes: readonly string[], progress: GenerationProgressMap, nowMs: number,
): string[] {
  return pendingGenerationTypesFrom(selectedTypes, progress)
    .filter((type) => effectiveGenerationState(progress[type], nowMs) !== "running");
}

export interface NextTypeOptions {
  maxAttempts?: number;
}

/**
 * Non-terminal types the run still owes, in generation order. A type that
 * burned its attempts is passed over so one failing type can never stall the
 * rest of the run (the run finishes with a soft error naming it). A type held
 * by someone else's live claim is NOT passed over: its claim answers 409 and
 * the worker waits for the owner, because only a terminal record settles it.
 */
function attemptableTypes(
  selectedTypes: readonly string[], progress: GenerationProgressMap, options: NextTypeOptions,
): string[] {
  const { maxAttempts = MAX_TYPE_ATTEMPTS_PER_RUN } = options;
  return pendingGenerationTypesFrom(selectedTypes, progress).filter((type) => {
    const entry = progress[type];
    return !(entry?.status === "failed" && (entry.attempt ?? 0) >= maxAttempts);
  });
}

/**
 * Whether generation is over for this package: every selected type is
 * completed or skipped, or failed past its attempts. False while any type is
 * pending or processing — live or stalled — however it got there, so a run
 * can never be marked succeeded over work someone else is still doing.
 */
export function allGenerationSettled(
  selectedTypes: readonly string[], progress: GenerationProgressMap, options: NextTypeOptions = {},
): boolean {
  return attemptableTypes(selectedTypes, progress, options).length === 0;
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
