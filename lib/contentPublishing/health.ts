// Operational truth for the admin: when the worker last ran, whether the
// database trigger exists and fired, how many schedules are overdue. A saved
// schedule is never shown as "healthy" on its own — only an observed tick is.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OVERDUE_GRACE_SECONDS, PUBLICATION_SCHEDULES_TABLE, PUBLICATION_WORKER_RUNS_TABLE, SCHEDULE_STATES, type ScheduleState,
} from "@/lib/contentPublishing/constants";
import type { PublishingHealth, WorkerRunRow } from "@/lib/contentPublishing/types";

export async function loadPublishingHealth(client: SupabaseClient, now = new Date()): Promise<PublishingHealth> {
  const graceCutoff = new Date(now.getTime() - OVERDUE_GRACE_SECONDS * 1000).toISOString();
  const [lastRun, states, overdue, refreshPending, trigger] = await Promise.all([
    client.from(PUBLICATION_WORKER_RUNS_TABLE).select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    client.from(PUBLICATION_SCHEDULES_TABLE).select("state"),
    // Past due, not claimed, and not deliberately waiting out a retry back-off.
    client.from(PUBLICATION_SCHEDULES_TABLE).select("id", { count: "exact", head: true })
      .eq("state", "queued").lte("due_at", graceCutoff)
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`),
    client.from(PUBLICATION_SCHEDULES_TABLE).select("id", { count: "exact", head: true }).eq("refresh_pending", true),
    client.rpc("publication_trigger_status"),
  ]);
  const counts = Object.fromEntries(SCHEDULE_STATES.map((s) => [s, 0])) as Record<ScheduleState, number>;
  for (const row of states.data ?? []) {
    const state = row.state as ScheduleState;
    if (state in counts) counts[state] += 1;
  }
  const t = (trigger.data ?? {}) as Record<string, unknown>;
  return {
    lastRun: (lastRun.data as WorkerRunRow | null) ?? null,
    overdue: overdue.count ?? 0,
    counts,
    refreshPending: refreshPending.count ?? 0,
    trigger: {
      installed: t.installed === true,
      scheduled: t.scheduled === true,
      active: typeof t.active === "boolean" ? t.active : null,
      schedule: typeof t.schedule === "string" ? t.schedule : null,
      lastRun: (t.last_run as PublishingHealth["trigger"]["lastRun"]) ?? null,
    },
    serverNow: now.toISOString(),
  };
}
