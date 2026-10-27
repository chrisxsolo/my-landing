// Server-only: records each photo sync (campus spots, location library) in
// photo_sync_runs, so a failed sync shows up in the admin and can be retried.
//
// Logging never changes the sync itself: if the log table is missing or a log
// write fails, the sync still runs and its own result or error is returned.
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_SYNC_RUNS_TABLE = "photo_sync_runs";

export type SyncKind = "campus_spots" | "location_library";
export type SyncTrigger = "admin" | "worker" | "retry";

export interface SyncRunOptions {
  kind: SyncKind;
  /** A session uuid, or null for a full sync. */
  scope?: string | null;
  trigger?: SyncTrigger;
  retryOf?: number | null;
}

export interface SyncRunRow {
  id: number;
  kind: SyncKind;
  scope: string | null;
  status: "running" | "ok" | "error";
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  detail: Record<string, unknown> | null;
  retryOf: number | null;
}

/** What a finished sync reports: an error message turns the run red even when nothing threw. */
export interface SyncOutcome {
  error?: string | null;
  detail?: Record<string, unknown>;
}

/** A logged run's outcome. */
export interface LoggedRun<T> {
  runId: number | null;
  ok: boolean;
  error: string | null;
  result: T | null;
  thrown?: unknown;
  /** Another run of the same kind and scope was already in progress, so this one did nothing. */
  skipped?: boolean;
}

/** A run still "running" after this long died without finishing (a sweep ends in well under a minute). */
export const STALE_RUN_MS = 15 * 60 * 1000;
export const STALLED_RUN_ERROR = "never finished — the sync stopped before reporting (timeout or crash)";
const UNIQUE_VIOLATION = "23505";

const RUN_COLUMNS = "id,kind,scope,status,trigger,started_at,finished_at,error,detail,retry_of";

const clip = (s: string) => s.slice(0, 2000);

// Closes runs of this kind that died mid-way, so they show as failed and stop
// blocking new runs. Best effort: a failure here never blocks the sync.
async function closeStalledRuns(client: SupabaseClient, kind: SyncKind): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString();
  try {
    const { error } = await client.from(PHOTO_SYNC_RUNS_TABLE)
      .update({ status: "error", error: STALLED_RUN_ERROR, finished_at: new Date().toISOString() })
      .eq("kind", kind).eq("status", "running").lt("started_at", cutoff);
    if (error) console.warn(`[photo-sync] could not close stalled ${kind} runs: ${error.message}`);
  } catch (err) {
    console.warn(`[photo-sync] could not close stalled ${kind} runs`, err);
  }
}

type StartResult = { id: number | null; busy: boolean };

async function startRun(client: SupabaseClient, opts: SyncRunOptions): Promise<StartResult> {
  await closeStalledRuns(client, opts.kind);
  const { data, error } = await client.from(PHOTO_SYNC_RUNS_TABLE).insert({
    kind: opts.kind,
    scope: opts.scope ?? null,
    trigger: opts.trigger ?? "admin",
    retry_of: opts.retryOf ?? null,
  }).select("id").single();
  if (error) {
    // The one-running-run-per-kind-and-scope index: another run is in progress.
    if (error.code === UNIQUE_VIOLATION) return { id: null, busy: true };
    console.warn(`[photo-sync] could not log the ${opts.kind} run: ${error.message}`);
    return { id: null, busy: false };
  }
  return { id: (data as { id: number }).id, busy: false };
}

async function finishRun(client: SupabaseClient, id: number | null, status: "ok" | "error", outcome: SyncOutcome): Promise<void> {
  if (id === null) return;
  const { error } = await client.from(PHOTO_SYNC_RUNS_TABLE).update({
    status,
    finished_at: new Date().toISOString(),
    error: outcome.error ? clip(outcome.error) : null,
    detail: outcome.detail ?? null,
  }).eq("id", id);
  if (error) console.warn(`[photo-sync] could not finish run ${id}: ${error.message}`);
}

/**
 * Runs a sync, logs it, and reports the outcome without throwing. `summarize`
 * turns the sync's own report into a status: a report carrying an error is
 * logged as failed. `thrown` holds the sync's own error when it threw.
 */
export async function runLogged<T>(
  client: SupabaseClient,
  opts: SyncRunOptions,
  run: () => Promise<T>,
  summarize: (result: T) => SyncOutcome = () => ({}),
): Promise<LoggedRun<T>> {
  const { id: runId, busy } = await startRun(client, opts);
  if (busy) {
    const scope = opts.scope ? `session ${opts.scope.slice(0, 8)}` : "full";
    console.info(`[photo-sync] ${opts.kind} (${scope}) already running — skipped`);
    return { runId: null, ok: false, error: `A ${opts.kind.replace("_", " ")} sync is already running.`, result: null, skipped: true };
  }
  try {
    const result = await run();
    const outcome = summarize(result);
    await finishRun(client, runId, outcome.error ? "error" : "ok", outcome);
    return { runId, ok: !outcome.error, error: outcome.error ?? null, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(client, runId, "error", { error: message });
    return { runId, ok: false, error: message, result: null, thrown: err };
  }
}

/**
 * Runs a sync and logs it. A report carrying an error is logged as failed; a
 * thrown error is logged and re-thrown, so callers keep their existing error
 * handling.
 */
export async function recordSyncRun<T>(
  client: SupabaseClient,
  opts: SyncRunOptions,
  run: () => Promise<T>,
  summarize: (result: T) => SyncOutcome = () => ({}),
): Promise<T> {
  const logged = await runLogged(client, opts, run, summarize);
  if ("thrown" in logged) throw logged.thrown;
  if (logged.skipped) throw new Error(logged.error ?? "sync already running");
  return logged.result as T;
}

function toRow(r: Record<string, unknown>): SyncRunRow {
  return {
    id: Number(r.id),
    kind: r.kind as SyncKind,
    scope: (r.scope as string | null) ?? null,
    status: r.status as SyncRunRow["status"],
    trigger: r.trigger as SyncTrigger,
    startedAt: String(r.started_at),
    finishedAt: (r.finished_at as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
    retryOf: (r.retry_of as number | null) ?? null,
  };
}

/** The most recent runs, newest first. */
export async function loadRecentSyncRuns(client: SupabaseClient, limit = 50): Promise<SyncRunRow[]> {
  const { data, error } = await client.from(PHOTO_SYNC_RUNS_TABLE)
    .select(RUN_COLUMNS)
    .order("started_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(`could not load photo sync runs: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toRow);
}

/** One run by id, or null when there is none. */
export async function loadSyncRun(client: SupabaseClient, id: number): Promise<SyncRunRow | null> {
  const { data, error } = await client.from(PHOTO_SYNC_RUNS_TABLE).select(RUN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`could not load photo sync run ${id}: ${error.message}`);
  return data ? toRow(data as Record<string, unknown>) : null;
}

export interface SyncHealth {
  lastOk: Partial<Record<SyncKind, string>>;
  /** Newest run of each kind, whatever its outcome. */
  lastAttempt: Partial<Record<SyncKind, string>>;
  /** Newest run started by the background worker — the worker's heartbeat. */
  lastWorkerRun: string | null;
  /** Failed (or stalled) runs not followed by a later successful run of the same kind and scope. */
  unresolvedFailures: SyncRunRow[];
}

/** A "running" row older than STALE_RUN_MS is reported as the failure it is. Pure. */
export function withStalledAsFailed(run: SyncRunRow, now: number): SyncRunRow {
  if (run.status !== "running") return run;
  const started = new Date(run.startedAt).getTime();
  if (Number.isNaN(started) || now - started < STALE_RUN_MS) return run;
  return { ...run, status: "error", error: run.error ?? STALLED_RUN_ERROR };
}

/** Summarises runs (newest first). Pure. */
export function summarizeSyncRuns(runs: readonly SyncRunRow[], now = Date.now()): SyncHealth {
  const lastOk: Partial<Record<SyncKind, string>> = {};
  const lastAttempt: Partial<Record<SyncKind, string>> = {};
  let lastWorkerRun: string | null = null;
  const settled = new Set<string>();
  const unresolvedFailures: SyncRunRow[] = [];
  for (const raw of runs) {
    const run = withStalledAsFailed(raw, now);
    lastAttempt[run.kind] ??= run.startedAt;
    if (run.trigger === "worker") lastWorkerRun ??= run.startedAt;
    const key = `${run.kind}:${run.scope ?? "*"}`;
    if (run.status === "ok") {
      lastOk[run.kind] ??= run.finishedAt ?? run.startedAt;
      settled.add(key);
      // A full sync that succeeded covers every session.
      if (run.scope === null) settled.add(`${run.kind}:any`);
      continue;
    }
    if (run.status !== "error") continue;
    if (settled.has(key) || settled.has(`${run.kind}:any`)) continue;
    settled.add(key);
    unresolvedFailures.push(run);
  }
  return { lastOk, lastAttempt, lastWorkerRun, unresolvedFailures };
}
