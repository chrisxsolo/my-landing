// The publication worker: one tick claims the due schedules, publishes each
// through the existing publishers, settles the row, then retries any pending
// cache refreshes. No AI, no browser, no after(): a plain server function the
// cron route calls once a minute. Everything it does is idempotent and fenced
// by the claim token, so overlapping ticks, duplicate deliveries and a worker
// that dies mid-batch all converge on exactly one publication per schedule.
import type { SupabaseClient } from "@supabase/supabase-js";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { publishBlogDraft } from "@/lib/contentPublishing/publishBlogDraft";
import { refreshPublicPaths, revalidateOnePath, type RevalidateFns } from "@/lib/contentPublishing/refresh";
import {
  MAX_PUBLISH_ATTEMPTS, PUBLICATION_SCHEDULES_TABLE, PUBLICATION_WORKER_RUNS_TABLE, REFRESH_SWEEP_LIMIT,
  RETRY_BACKOFF_BASE_SECONDS, RETRY_BACKOFF_MAX_SECONDS, WORKER_BATCH_LIMIT, WORKER_LEASE_SECONDS, WORKER_RUN_RETENTION_DAYS,
} from "@/lib/contentPublishing/constants";
import type { PublicationScheduleRow } from "@/lib/contentPublishing/types";

export interface WorkerSummary {
  runId: number | null;
  claimed: number;
  published: number;
  blocked: number;
  failed: number;
  retried: number;
  refreshed: number;
  /** Engine items that went live this tick (the route kicks their follow-up syncs). */
  publishedItemIds: string[];
  results: { scheduleId: string; outcome: "published" | "blocked" | "retry" | "failed"; detail: string }[];
}

export interface WorkerArgs {
  client: SupabaseClient;
  source?: string;
  /** Injectable for tests; the route passes Next's revalidate functions. */
  revalidate?: RevalidateFns;
  now?: () => Date;
  batchLimit?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
}

export type SettleOutcome =
  | { kind: "published"; refreshFailures: string[] }
  | { kind: "blocked"; reason: string }
  | { kind: "failed"; error: string };

/** 1, 2, 4, 8… minutes, capped. attempts counts the claim that just failed. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(RETRY_BACKOFF_MAX_SECONDS, RETRY_BACKOFF_BASE_SECONDS * 2 ** Math.max(0, attempts - 1));
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const noopRevalidate: RevalidateFns = { tag: () => {}, path: () => {} };

/** A per-path marker that throws, so the publishers report the path as a failure the worker records. */
function pathRevalidator(fns: RevalidateFns): (path: string) => void {
  return (path) => revalidateOnePath(path, fns);
}

async function publishOne(client: SupabaseClient, row: PublicationScheduleRow, fns: RevalidateFns): Promise<SettleOutcome> {
  const claim = { id: row.id, claimToken: row.claim_token as string, allowEarly: false };
  const revalidate = pathRevalidator(fns);
  if (row.target_kind === "content_item") {
    const outcome = await publishApprovedItem({ client, itemId: row.content_item_id as string, revalidate, schedule: claim });
    if (outcome.status === "published") return { kind: "published", refreshFailures: outcome.revalidationFailures };
    return outcome.status === "blocked" ? { kind: "blocked", reason: outcome.reason } : { kind: "failed", error: outcome.error };
  }
  const outcome = await publishBlogDraft({ client, draftId: row.blog_draft_id as string, revalidate, schedule: claim });
  if (outcome.status === "published") return { kind: "published", refreshFailures: outcome.revalidationFailures };
  return outcome.status === "blocked" ? { kind: "blocked", reason: outcome.reason } : { kind: "failed", error: outcome.error };
}

/**
 * Writes the outcome back, fenced by the claim token and the processing state:
 * a row that was cancelled meanwhile, or re-claimed by another worker after a
 * lease expiry, is left alone. Returns what happened for the summary.
 */
export async function settleSchedule(
  client: SupabaseClient, row: PublicationScheduleRow, outcome: SettleOutcome, now: Date, maxAttempts = MAX_PUBLISH_ATTEMPTS,
): Promise<"published" | "blocked" | "retry" | "failed"> {
  const logged = (label: string) => ({ error }: { error: { message: string } | null }) => {
    // A lost settle is recovered by the lease (the row is reclaimed), but say so.
    if (error) console.error(`[publishing] could not record ${label} for schedule ${row.id}: ${error.message}`);
  };
  if (outcome.kind === "published") {
    // The RPC already set state=published and cleared the token.
    await client.from(PUBLICATION_SCHEDULES_TABLE)
      .update({ refresh_pending: outcome.refreshFailures.length > 0, refresh_paths: outcome.refreshFailures })
      .eq("id", row.id).eq("state", "published").then(logged("the refresh outcome"));
    return "published";
  }
  const base = { claim_token: null, lease_expires_at: null };
  if (outcome.kind === "blocked") {
    await client.from(PUBLICATION_SCHEDULES_TABLE)
      .update({ ...base, state: "blocked", last_error: outcome.reason.slice(0, 2000), next_attempt_at: null })
      .eq("id", row.id).eq("claim_token", row.claim_token).eq("state", "processing").then(logged("the block"));
    return "blocked";
  }
  const exhausted = row.attempts >= maxAttempts;
  await client.from(PUBLICATION_SCHEDULES_TABLE)
    .update({
      ...base,
      state: exhausted ? "failed" : "queued",
      last_error: outcome.error.slice(0, 2000),
      next_attempt_at: exhausted ? null : new Date(now.getTime() + retryDelaySeconds(row.attempts) * 1000).toISOString(),
    })
    .eq("id", row.id).eq("claim_token", row.claim_token).eq("state", "processing").then(logged("the retry"));
  return exhausted ? "failed" : "retry";
}

/** Retries the public-cache refresh of published rows whose refresh did not land. */
export async function sweepPendingRefreshes(client: SupabaseClient, fns: RevalidateFns, limit = REFRESH_SWEEP_LIMIT): Promise<number> {
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE)
    .select("id,refresh_paths").eq("refresh_pending", true).eq("state", "published").limit(limit);
  if (error) throw new Error(`could not load pending refreshes: ${error.message}`);
  let refreshed = 0;
  for (const row of data ?? []) {
    const paths = Array.isArray(row.refresh_paths) ? (row.refresh_paths as string[]) : [];
    const result = refreshPublicPaths(paths, fns);
    if (!result.ok) continue;
    await client.from(PUBLICATION_SCHEDULES_TABLE)
      .update({ refresh_pending: false, refresh_paths: [] }).eq("id", row.id).eq("refresh_pending", true);
    refreshed += 1;
  }
  return refreshed;
}

async function startRun(client: SupabaseClient, source: string): Promise<number | null> {
  const { data, error } = await client.from(PUBLICATION_WORKER_RUNS_TABLE).insert({ source }).select("id").single();
  if (error) {
    console.error("[publishing] could not record the worker heartbeat", error);
    return null;
  }
  return data.id as number;
}

async function finishRun(client: SupabaseClient, runId: number | null, summary: WorkerSummary, now: Date, error: string | null) {
  if (runId === null) return;
  const { claimed, published, blocked, failed, retried, refreshed } = summary;
  await client.from(PUBLICATION_WORKER_RUNS_TABLE)
    .update({ finished_at: now.toISOString(), claimed, published, blocked, failed, retried, refreshed, error })
    .eq("id", runId);
  const cutoff = new Date(now.getTime() - WORKER_RUN_RETENTION_DAYS * 86_400_000).toISOString();
  await client.from(PUBLICATION_WORKER_RUNS_TABLE).delete().lt("started_at", cutoff);
}

export async function runPublicationWorker(args: WorkerArgs): Promise<WorkerSummary> {
  const { client } = args;
  const clock = args.now ?? (() => new Date());
  const fns = args.revalidate ?? noopRevalidate;
  const summary: WorkerSummary = {
    runId: null, claimed: 0, published: 0, blocked: 0, failed: 0, retried: 0, refreshed: 0, publishedItemIds: [], results: [],
  };
  summary.runId = await startRun(client, args.source ?? "cron");
  let runError: string | null = null;
  try {
    const { data, error } = await client.rpc("claim_publication_schedules", {
      p_limit: args.batchLimit ?? WORKER_BATCH_LIMIT, p_lease_seconds: args.leaseSeconds ?? WORKER_LEASE_SECONDS,
      p_max_attempts: args.maxAttempts ?? MAX_PUBLISH_ATTEMPTS,
    });
    if (error) throw new Error(`could not claim schedules: ${error.message}`);
    const claimed = (data ?? []) as PublicationScheduleRow[];
    summary.claimed = claimed.length;
    for (const row of claimed) await workOne(client, row, fns, clock, summary, args.maxAttempts);
    summary.refreshed = await sweepPendingRefreshes(client, fns);
  } catch (err) {
    runError = message(err);
    console.error("[publishing] worker tick failed", err);
  }
  await finishRun(client, summary.runId, summary, clock(), runError);
  if (runError) throw new Error(runError);
  return summary;
}

async function workOne(
  client: SupabaseClient, row: PublicationScheduleRow, fns: RevalidateFns, clock: () => Date,
  summary: WorkerSummary, maxAttempts?: number,
): Promise<void> {
  let outcome: SettleOutcome;
  try {
    outcome = await publishOne(client, row, fns);
  } catch (err) {
    // An unexpected throw (network, storage) is a transient failure: bounded retry.
    outcome = { kind: "failed", error: message(err) };
  }
  const settled = await settleSchedule(client, row, outcome, clock(), maxAttempts);
  const detail = outcome.kind === "published"
    ? (outcome.refreshFailures.length ? `published; refresh pending for ${outcome.refreshFailures.join(", ")}` : "published")
    : outcome.kind === "blocked" ? outcome.reason : outcome.error;
  summary.results.push({ scheduleId: row.id, outcome: settled, detail });
  if (settled === "published") {
    summary.published += 1;
    if (row.content_item_id) summary.publishedItemIds.push(row.content_item_id);
  } else if (settled === "blocked") summary.blocked += 1;
  else if (settled === "retry") summary.retried += 1;
  else summary.failed += 1;
}
