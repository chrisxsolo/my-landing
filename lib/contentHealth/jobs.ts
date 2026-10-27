// Content Engine run queue health: how many runs are waiting, working,
// stalled or failed, and the most recent failures with their error, so a
// failed background run is visible on the dashboard instead of only inside
// its own session page.
import type { SupabaseClient } from "@supabase/supabase-js";

export const JOBS_TABLE = "content_engine_jobs";
const JOB_HEALTH_COLUMNS = "id,photography_session_id,status,attempts,last_error,lease_expires_at,updated_at,finished_at";
/** Enough recent rows to see every live run and the latest failures. */
const JOB_WINDOW = 200;
const RECENT_FAILURES = 5;
/** Failures older than this have been seen and are not "recent". */
const FAILURE_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
/** A queued run waiting longer than this means the worker is not ticking. */
export const QUEUED_TOO_LONG_MS = 6 * 60 * 60 * 1000;

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobRow {
  id: string;
  photography_session_id: string;
  status: JobStatus;
  attempts: number;
  last_error: string | null;
  lease_expires_at: string | null;
  updated_at: string;
  finished_at: string | null;
}

export interface JobFailureDto {
  jobId: string;
  sessionId: string;
  error: string | null;
  attempts: number;
  at: string;
}

export interface JobsHealthDto {
  queued: number;
  running: number;
  /** Running with an expired lease: the worker died; the next tick reclaims it. */
  stalled: number;
  /** Queued for longer than QUEUED_TOO_LONG_MS. */
  waitingTooLong: number;
  recentFailures: JobFailureDto[];
  lastActivity: string | null;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.NaN);

/** Pure: rows newest first. */
export function jobsHealthFrom(rows: readonly JobRow[], now = Date.now()): JobsHealthDto {
  const live = (status: JobStatus) => rows.filter((r) => r.status === status);
  const running = live("running");
  const queued = live("queued");
  const recentFailures = live("failed")
    .filter((r) => now - ms(r.finished_at ?? r.updated_at) <= FAILURE_LOOKBACK_MS)
    .slice(0, RECENT_FAILURES)
    .map((r) => ({
      jobId: r.id, sessionId: r.photography_session_id, error: r.last_error,
      attempts: r.attempts, at: r.finished_at ?? r.updated_at,
    }));
  return {
    queued: queued.length,
    running: running.length,
    stalled: running.filter((r) => ms(r.lease_expires_at) <= now).length,
    waitingTooLong: queued.filter((r) => now - ms(r.updated_at) > QUEUED_TOO_LONG_MS).length,
    recentFailures,
    lastActivity: rows[0]?.updated_at ?? null,
  };
}

export async function loadJobsHealth(client: SupabaseClient): Promise<JobsHealthDto> {
  const { data, error } = await client.from(JOBS_TABLE)
    .select(JOB_HEALTH_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(JOB_WINDOW);
  if (error) throw new Error(`could not load content runs: ${error.message}`);
  return jobsHealthFrom((data ?? []) as JobRow[]);
}
