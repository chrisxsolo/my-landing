// Server-only: runs the session-location inheritance plan for one session
// (lib/photoTagging/inheritLocation.ts) through the same executor every tag
// write uses, so each change lands in photo_change_log as a "system" change
// and can be restored from the history like any other.
//
// Called when Session facts are saved (every included photo), after an upload
// is finalized (that photo only) and by the Resync action. Idempotent and
// safe to retry: a run that finds nothing to change writes nothing. Reads the
// session's photos page by page so a large session is never half-synced.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadKnownPlaces } from "@/lib/locations/registry";
import { executePlan, type ApplyResult } from "@/lib/photoTagging/apply";
import { planLocationInheritance, type InheritablePhotoRow, type SessionLocationFacts } from "@/lib/photoTagging/inheritLocation";
import { SESSION_PHOTOS_TABLE } from "@/lib/photoTagging/types";
import { fetchAllPages } from "@/lib/supabasePaging";

const SESSIONS_TABLE = "photography_sessions";
const PHOTO_COLUMNS = "id,excluded,photo_location,photo_location_source,photo_location_evidence";

export interface InheritanceSyncOptions {
  /** Only these photos (a fresh upload); default every photo of the session. */
  photoIds?: readonly string[];
  /** Noted in the change history. */
  reason?: string;
}

/** What a caller reports back to the admin. */
export interface InheritanceSyncSummary {
  /** Photo locations written (filled, updated or cleared). */
  updated: number;
  failed: number;
  error: string | null;
}

export const NO_INHERITANCE_CHANGES: InheritanceSyncSummary = { updated: 0, failed: 0, error: null };

async function loadFacts(client: SupabaseClient, sessionId: string): Promise<SessionLocationFacts | null> {
  const { data, error } = await client.from(SESSIONS_TABLE)
    .select("primary_location,secondary_locations").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`could not read the session's location facts: ${error.message}`);
  return (data as SessionLocationFacts | null) ?? null;
}

async function loadRows(client: SupabaseClient, sessionId: string, photoIds?: readonly string[]): Promise<InheritablePhotoRow[]> {
  return fetchAllPages<InheritablePhotoRow>((from, to) => {
    let query = client.from(SESSION_PHOTOS_TABLE).select(PHOTO_COLUMNS).eq("photography_session_id", sessionId);
    if (photoIds) query = query.in("id", [...photoIds]);
    return query.order("id").range(from, to);
  }, "session photos for location inheritance");
}

/**
 * Brings the session's photo locations in line with its facts. Throws when
 * the facts or photos cannot be read (nothing is written then); a write that
 * fails is reported in the result, never hidden.
 */
export async function syncSessionLocationInheritance(
  client: SupabaseClient, sessionId: string, opts: InheritanceSyncOptions = {},
): Promise<ApplyResult> {
  const [facts, rows, places] = await Promise.all([
    loadFacts(client, sessionId), loadRows(client, sessionId, opts.photoIds), loadKnownPlaces(client),
  ]);
  if (!facts) throw new Error(`session ${sessionId} not found`);
  const plan = planLocationInheritance(sessionId, facts, rows, places);
  if (plan.writes.length === 0) {
    return { updated: 0, failed: 0, kept: 0, skipped: 0, conflicts: 0, outcomes: plan.outcomes, failures: [], sessionIds: [] };
  }
  return executePlan(client, plan, { actor: "system", reason: opts.reason ?? "session location inheritance" });
}

/** The summary an admin response carries; a thrown error becomes a failed sync, never a silent success. */
export async function syncSessionLocationInheritanceSummary(
  client: SupabaseClient, sessionId: string, opts: InheritanceSyncOptions = {},
): Promise<InheritanceSyncSummary> {
  try {
    const result = await syncSessionLocationInheritance(client, sessionId, opts);
    return { updated: result.updated, failed: result.failed, error: result.failures[0] ?? null };
  } catch (err) {
    console.error(`[photo-tagging] session location inheritance failed for ${sessionId}`, err);
    return { updated: 0, failed: 1, error: err instanceof Error ? err.message : "location sync failed" };
  }
}
