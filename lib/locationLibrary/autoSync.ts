// Server-only: the automatic path. Routes that change what a session proves
// about its location (publish, facts, location confirmation) call
// syncSessionInBackground; it runs after the response (next/server after()),
// so a sync problem can never fail the admin's own action. New drafts get an
// AI profile in the same background run; the admin can always regenerate.
// Every sync is logged in photo_sync_runs (lib/photoSync/runLog): a session
// that failed is visible in the admin and can be retried from there.
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { runLogged, type LoggedRun, type SyncTrigger } from "@/lib/photoSync/runLog";
import { generateLocationProfile } from "@/lib/locationLibrary/profile";
import {
  syncAllSessions, syncSessionLocations, type FullSyncReport, type SessionSyncReport,
} from "@/lib/locationLibrary/sync";
import { summarizeFullSync, summarizeSessionSync } from "@/lib/locationLibrary/syncSummary";

/** Profiles the drafts a sync created. Without an API key the drafts simply wait for review. */
export async function profileNewDrafts(client: SupabaseClient, locationIds: number[]): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || locationIds.length === 0) return;
  const callModel = createAnthropicCaller(apiKey);
  for (const id of locationIds) await generateLocationProfile(client, callModel, id);
}

/** After a sync: profile its new drafts (a profile failure never fails the sync), then refresh the public pages. */
async function finishSync(client: SupabaseClient, createdIds: number[], revalidate: boolean): Promise<void> {
  try {
    await profileNewDrafts(client, createdIds);
  } catch (err) {
    console.error("[location-library] could not profile new drafts", err);
  }
  if (revalidate) revalidatePublicContent();
}

/** One logged session sync. Never throws: a failure is in the result (and in photo_sync_runs). */
export async function syncSessionLogged(
  sessionId: string, trigger: SyncTrigger, retryOf: number | null = null,
): Promise<LoggedRun<SessionSyncReport>> {
  const client = createSupabaseAdminClient();
  const run = await runLogged(client, { kind: "location_library", scope: sessionId, trigger, retryOf },
    () => syncSessionLocations(client, sessionId), summarizeSessionSync);
  if (run.result) await finishSync(client, run.result.createdLocationIds, run.result.status !== "error");
  return run;
}

export async function syncSessionNow(sessionId: string): Promise<SessionSyncReport> {
  const run = await syncSessionLogged(sessionId, "admin");
  if ("thrown" in run) throw run.thrown;
  return run.result as SessionSyncReport;
}

/** One logged sync of every session. Never throws. */
export async function syncAllSessionsLogged(
  trigger: SyncTrigger, retryOf: number | null = null,
): Promise<LoggedRun<FullSyncReport>> {
  const client = createSupabaseAdminClient();
  const run = await runLogged(client, { kind: "location_library", scope: null, trigger, retryOf },
    () => syncAllSessions(client), summarizeFullSync);
  if (run.result) await finishSync(client, run.result.sessions.flatMap((s) => s.createdLocationIds), true);
  return run;
}

/** Queues a session sync after the response. Never throws into the caller. */
export function syncSessionInBackground(sessionId: string | null | undefined): void {
  if (!sessionId) return;
  try {
    after(async () => {
      try {
        await syncSessionNow(sessionId);
      } catch (err) {
        console.error(`[location-library] background sync failed for ${sessionId}`, err);
      }
    });
  } catch (err) {
    console.error("[location-library] could not schedule a background sync", err);
  }
}

/** The session a content item belongs to (publish routes only know the item). */
export async function sessionIdForItem(client: SupabaseClient, itemId: string): Promise<string | null> {
  const { data, error } = await client.from("session_content_items")
    .select("session_content_packages!inner(photography_session_id)").eq("id", itemId).maybeSingle();
  if (error) {
    console.error(`[location-library] could not find the session for item ${itemId}`, error.message);
    return null;
  }
  const pkg = data?.session_content_packages as unknown as { photography_session_id: string } | { photography_session_id: string }[] | undefined;
  const one = Array.isArray(pkg) ? pkg[0] : pkg;
  return one?.photography_session_id ?? null;
}

/** After a publish: find the item's session and sync it, all after the response. */
export function syncItemSessionInBackground(itemId: string): void {
  try {
    after(async () => {
      try {
        const sessionId = await sessionIdForItem(createSupabaseAdminClient(), itemId);
        if (sessionId) await syncSessionNow(sessionId);
      } catch (err) {
        console.error(`[location-library] background sync failed for item ${itemId}`, err);
      }
    });
  } catch (err) {
    console.error("[location-library] could not schedule a background sync", err);
  }
}

/**
 * The backstop sweep (worker tick): re-syncs every session so a lost
 * background run heals itself. Deterministic and cheap; never throws.
 */
export async function sweepLocationLibrary(): Promise<{ sessions: number; errors: number } | null> {
  try {
    const run = await syncAllSessionsLogged("worker");
    if (run.skipped) return null;
    if (!run.result) {
      console.error("[location-library] sweep failed", run.thrown ?? run.error);
      return null;
    }
    const report = run.result;
    return { sessions: report.sessions.length, errors: report.sessions.filter((s) => s.status === "error").length };
  } catch (err) {
    console.error("[location-library] sweep failed", err);
    return null;
  }
}
