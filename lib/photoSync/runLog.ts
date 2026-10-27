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

const clip = (s: string) => s.slice(0, 2000);

async function startRun(client: SupabaseClient, opts: SyncRunOptions): Promise<number | null> {
  const { data, error } = await client.from(PHOTO_SYNC_RUNS_TABLE).insert({
    kind: opts.kind,
    scope: opts.scope ?? null,
    trigger: opts.trigger ?? "admin",
    retry_of: opts.retryOf ?? null,
  }).select("id").single();
  if (error) {
    console.warn(`[photo-sync] could not log the ${opts.kind} run: ${error.message}`);
    return null;
  }
  return (data as { id: number }).id;
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
 * Runs a sync and logs it. `summarize` turns the sync's own report into a
 * status: a report carrying an error is logged as failed. A thrown error is
 * logged and re-thrown, so callers keep their existing error handling.
 */
export async function recordSyncRun<T>(
  client: SupabaseClient,
  opts: SyncRunOptions,
  run: () => Promise<T>,
  summarize: (result: T) => SyncOutcome = () => ({}),
): Promise<T> {
  const id = await startRun(client, opts);
  try {
    const result = await run();
    const outcome = summarize(result);
    await finishRun(client, id, outcome.error ? "error" : "ok", outcome);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(client, id, "error", { error: message });
    throw err;
  }
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
    .select("id,kind,scope,status,trigger,started_at,finished_at,error,detail,retry_of")
    .order("started_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(`could not load photo sync runs: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toRow);
}

export interface SyncHealth {
  lastOk: Partial<Record<SyncKind, string>>;
  /** Failed runs not followed by a later successful run of the same kind and scope. */
  unresolvedFailures: SyncRunRow[];
}

/** Summarises runs (newest first). Pure. */
export function summarizeSyncRuns(runs: readonly SyncRunRow[]): SyncHealth {
  const lastOk: Partial<Record<SyncKind, string>> = {};
  const settled = new Set<string>();
  const unresolvedFailures: SyncRunRow[] = [];
  for (const run of runs) {
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
  return { lastOk, unresolvedFailures };
}
