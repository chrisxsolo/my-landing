// Content sync health: the shape GET /api/admin/content-health returns and the
// pure helpers that build it. Each part settles on its own — a part that could
// not be read is { ok: false } and shows "unavailable", never a misleading 0.
import type { SyncKind, SyncRunRow } from "@/lib/photoSync/runLog";
import { summarizeSyncRuns } from "@/lib/photoSync/runLog";
import type { TagCounts } from "@/lib/photoTagging/types";
import type { JobsHealthDto } from "@/lib/contentHealth/jobs";

export type HealthPart<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SyncFailureDto {
  runId: number;
  kind: SyncKind;
  /** A session uuid, or null for a full sync. */
  scope: string | null;
  error: string | null;
  startedAt: string;
}

export interface SyncHealthDto {
  lastOk: Partial<Record<SyncKind, string>>;
  lastAttempt: Partial<Record<SyncKind, string>>;
  /** Newest sync started by the background worker: its heartbeat. */
  lastWorkerRun: string | null;
  failures: SyncFailureDto[];
}

/** The worker should tick every few minutes; this long without a tick is worth a look. */
export const WORKER_QUIET_MS = 6 * 60 * 60 * 1000;

/** True when the worker has not ticked recently (or never has). Pure. */
export function workerLooksIdle(lastWorkerRun: string | null, now = Date.now()): boolean {
  if (!lastWorkerRun) return true;
  const at = new Date(lastWorkerRun).getTime();
  return Number.isNaN(at) || now - at > WORKER_QUIET_MS;
}

export interface TaggingHealthDto {
  needsTagging: number;
  gradsMissingSchool: number;
  awaitingLocation: number;
}

export interface CampusSpotHealthDto {
  /** Spots on /grad-guide/campus-spots showing no photo right now. */
  empty: number;
  /** Empty spots the next sync would fill. */
  fillable: number;
}

export interface GuideReviewDto {
  awaitingReview: number;
}

export interface PublishedPhotosDto {
  published: number;
}

export interface ContentHealthReport {
  sync: HealthPart<SyncHealthDto>;
  jobs: HealthPart<JobsHealthDto>;
  publishedPhotos: HealthPart<PublishedPhotosDto>;
  tagging: HealthPart<TaggingHealthDto>;
  campusSpots: HealthPart<CampusSpotHealthDto>;
  locationGuides: HealthPart<GuideReviewDto>;
}

/** Runs one part; a throw becomes { ok: false } with the reason, logged with context. */
export async function settlePart<T>(label: string, run: () => Promise<T>): Promise<HealthPart<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[content-health] ${label} unavailable: ${error}`);
    return { ok: false, error };
  }
}

/** Last success per kind and failures not since resolved, from runs newest first. */
export function syncHealthFrom(runs: readonly SyncRunRow[], now = Date.now()): SyncHealthDto {
  const { lastOk, lastAttempt, lastWorkerRun, unresolvedFailures } = summarizeSyncRuns(runs, now);
  return {
    lastOk,
    lastAttempt,
    lastWorkerRun,
    failures: unresolvedFailures.map((r) => ({
      runId: r.id, kind: r.kind, scope: r.scope, error: r.error, startedAt: r.startedAt,
    })),
  };
}

/** Tagging counts; an audit with read errors is incomplete, so its counts are not reported. */
export function taggingHealthFrom(report: { counts: TagCounts; errors: readonly string[] }): TaggingHealthDto {
  if (report.errors.length > 0) throw new Error(`photo audit incomplete — ${report.errors.join("; ")}`);
  return {
    needsTagging: report.counts.needs,
    gradsMissingSchool: report.counts.gradsMissingSchool,
    awaitingLocation: report.counts.unresolvedLocation,
  };
}

/** From a dry-run campus spot sync: spots with no photo of their own and no automatic photo kept. */
export function campusSpotHealthFrom(report: {
  notMatchable: readonly unknown[]; claimed: readonly unknown[]; unmatched: readonly unknown[];
}): CampusSpotHealthDto {
  return {
    empty: report.notMatchable.length + report.claimed.length + report.unmatched.length,
    fillable: report.claimed.length,
  };
}
