// Server-only: the automatic path. Routes that change what a session proves
// about its location (publish, facts, location confirmation) call
// syncSessionInBackground; it runs after the response (next/server after()),
// so a sync problem can never fail the admin's own action. New drafts get an
// AI profile in the same background run; the admin can always regenerate.
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { generateLocationProfile } from "@/lib/locationLibrary/profile";
import { syncAllSessions, syncSessionLocations, type SessionSyncReport } from "@/lib/locationLibrary/sync";

/** Profiles the drafts a sync created. Without an API key the drafts simply wait for review. */
export async function profileNewDrafts(client: SupabaseClient, locationIds: number[]): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || locationIds.length === 0) return;
  const callModel = createAnthropicCaller(apiKey);
  for (const id of locationIds) await generateLocationProfile(client, callModel, id);
}

export async function syncSessionNow(sessionId: string): Promise<SessionSyncReport> {
  const client = createSupabaseAdminClient();
  const report = await syncSessionLocations(client, sessionId);
  await profileNewDrafts(client, report.createdLocationIds);
  if (report.status !== "error") revalidatePublicContent();
  return report;
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
    const client = createSupabaseAdminClient();
    const report = await syncAllSessions(client);
    await profileNewDrafts(client, report.sessions.flatMap((s) => s.createdLocationIds));
    revalidatePublicContent();
    return { sessions: report.sessions.length, errors: report.sessions.filter((s) => s.status === "error").length };
  } catch (err) {
    console.error("[location-library] sweep failed", err);
    return null;
  }
}
