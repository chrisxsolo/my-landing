// Admin-side operations on the publication queue: create, reschedule, cancel,
// retry, and the admin's "Publish now" claim. Every change is guarded by the
// schedule_version the client saw, so two devices cannot silently overwrite
// each other, and every state change is a conditional UPDATE — the worker's
// commit RPC is the authority for what actually publishes.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BLOG_POST_DRAFTS_TABLE, PUBLICATION_SCHEDULES_TABLE, SCHEDULABLE_CONTENT_TYPES,
  UNSCHEDULABLE_CONTENT_TYPE_REASONS, WORKER_LEASE_SECONDS, type ScheduleTargetKind,
} from "@/lib/contentPublishing/constants";
import { formatWallTime, resolveScheduleInstant, type ScheduleInput } from "@/lib/contentPublishing/localTime";
import { SCHEDULE_COLUMNS, type PublicationScheduleDto, type PublicationScheduleRow } from "@/lib/contentPublishing/types";
import { draftIncompleteReason, type DraftCompletenessRow } from "@/lib/contentPublishing/blogDrafts";
import { publishBlockReason } from "@/lib/contentEngine/publishPreflight";

const ITEMS_TABLE = "session_content_items";
// Deployed ahead of migration 20261106000001: the engine's workspace, autosave
// and reject must keep working, so a MISSING queue table (and only that:
// PostgREST says PGRST205, Postgres 42P01) is "no schedules".
const MISSING_TABLE = /could not find the table .*publication_schedules|relation .*publication_schedules.* does not exist/i;
function missingTable(error: { message: string; code?: string }): boolean {
  if (!(error.code === "42P01" || error.code === "PGRST205" || MISSING_TABLE.test(error.message))) return false;
  console.warn("[publishing] publication_schedules is not migrated yet; treating as no schedules");
  return true;
}
const PACKAGES_TABLE = "session_content_packages";
const SESSIONS_TABLE = "photography_sessions";
const RESCHEDULABLE_STATES = ["queued", "blocked", "failed"] as const;

export interface ScheduleTarget { kind: ScheduleTargetKind; id: string }

export type ScheduleMutationResult =
  | { outcome: "ok"; schedule: PublicationScheduleDto }
  | { outcome: "invalid"; message: string; code?: string }
  | { outcome: "not_found" }
  | { outcome: "not_ready"; message: string }
  | { outcome: "conflict"; message: string; schedule?: PublicationScheduleDto }
  | { outcome: "already_published"; schedule: PublicationScheduleDto };

export function toScheduleDto(row: PublicationScheduleRow | Record<string, unknown>): PublicationScheduleDto {
  const { claim_token: _token, ...rest } = row as PublicationScheduleRow;
  void _token;
  return rest;
}

export async function loadSchedule(client: SupabaseClient, id: string): Promise<PublicationScheduleRow | null> {
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`could not load schedule: ${error.message}`);
  return (data as PublicationScheduleRow | null) ?? null;
}

/** The active (queued/processing/blocked/failed) schedule of a target, if any. */
export async function activeScheduleFor(client: SupabaseClient, target: ScheduleTarget): Promise<PublicationScheduleDto | null> {
  const column = target.kind === "content_item" ? "content_item_id" : "blog_draft_id";
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).select(SCHEDULE_COLUMNS)
    .eq(column, target.id).in("state", ["queued", "processing", "blocked", "failed"]).maybeSingle();
  if (error) throw new Error(`could not load schedule: ${error.message}`);
  return (data as unknown as PublicationScheduleDto | null) ?? null;
}

/** Active schedules for a set of engine items (the workspace shows these on the cards). */
export async function activeSchedulesForItems(client: SupabaseClient, itemIds: string[]): Promise<PublicationScheduleDto[]> {
  if (itemIds.length === 0) return [];
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).select(SCHEDULE_COLUMNS)
    .in("content_item_id", itemIds).in("state", ["queued", "processing", "blocked", "failed"]);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`could not load schedules: ${error.message}`);
  }
  return (data ?? []) as unknown as PublicationScheduleDto[];
}

interface ReadyTarget { revision: number }
type ReadyResult = { ok: true; target: ReadyTarget } | { ok: false; result: ScheduleMutationResult };

// An engine item can be scheduled when it is approved, of a type that has a
// publisher, on a session cleared for marketing, and passes the same
// location/link preflight the immediate publish runs — so the admin learns
// about a problem now, not at 9:00 AM next Tuesday.
async function readyContentItem(client: SupabaseClient, itemId: string): Promise<ReadyResult> {
  const { data: item, error } = await client.from(ITEMS_TABLE)
    .select("id,content_type,status,payload,payload_revision,package_id").eq("id", itemId).maybeSingle();
  if (error) throw new Error(`could not load item: ${error.message}`);
  if (!item) return { ok: false, result: { outcome: "not_found" } };
  const unschedulable = UNSCHEDULABLE_CONTENT_TYPE_REASONS[item.content_type as string];
  if (unschedulable || !SCHEDULABLE_CONTENT_TYPES.includes(item.content_type as string)) {
    return { ok: false, result: { outcome: "not_ready", message: unschedulable ?? `${item.content_type} cannot be published automatically` } };
  }
  if (item.status !== "approved") {
    return { ok: false, result: { outcome: "not_ready", message: `only approved items can be scheduled (this one is ${item.status})` } };
  }
  const { data: pkg } = await client.from(PACKAGES_TABLE).select("photography_session_id,archived_at").eq("id", item.package_id).maybeSingle();
  if (!pkg) return { ok: false, result: { outcome: "not_ready", message: "the item's package no longer exists" } };
  if (pkg.archived_at) return { ok: false, result: { outcome: "not_ready", message: "the item belongs to an archived package" } };
  const { data: session } = await client.from(SESSIONS_TABLE).select("marketing_permission").eq("id", pkg.photography_session_id).maybeSingle();
  if (!session?.marketing_permission) {
    return { ok: false, result: { outcome: "not_ready", message: "marketing permission is not enabled for this session" } };
  }
  const blocked = await publishBlockReason(client, item.content_type as string, item.payload as Record<string, unknown>, item.package_id as string);
  if (blocked) return { ok: false, result: { outcome: "not_ready", message: blocked } };
  return { ok: true, target: { revision: item.payload_revision as number } };
}

async function readyBlogDraft(client: SupabaseClient, draftId: string): Promise<ReadyResult> {
  const { data: draft, error } = await client.from(BLOG_POST_DRAFTS_TABLE)
    .select("id,title,body,slug,images,status,revision").eq("id", draftId).maybeSingle();
  if (error) throw new Error(`could not load draft: ${error.message}`);
  if (!draft) return { ok: false, result: { outcome: "not_found" } };
  if (draft.status === "published") return { ok: false, result: { outcome: "not_ready", message: "this draft is already published" } };
  const { data: taken } = await client.from("blog_posts").select("id").eq("slug", draft.slug as string).maybeSingle();
  const incomplete = draftIncompleteReason(draft as DraftCompletenessRow, taken !== null);
  if (incomplete) return { ok: false, result: { outcome: "not_ready", message: incomplete } };
  return { ok: true, target: { revision: draft.revision as number } };
}

export interface CreateScheduleArgs {
  client: SupabaseClient;
  target: ScheduleTarget;
  when: ScheduleInput;
  /** The revision the admin reviewed; a different current revision is a conflict. */
  expectedRevision?: number;
  now?: Date;
}

export async function createSchedule(args: CreateScheduleArgs): Promise<ScheduleMutationResult> {
  const { client, target, when } = args;
  const now = args.now ?? new Date();
  const resolved = resolveScheduleInstant(when, now);
  if (!resolved.ok) return { outcome: "invalid", message: resolved.message, code: resolved.code };

  const ready = target.kind === "content_item"
    ? await readyContentItem(client, target.id)
    : await readyBlogDraft(client, target.id);
  if (!ready.ok) return ready.result;
  if (args.expectedRevision !== undefined && args.expectedRevision !== ready.target.revision) {
    return { outcome: "conflict", message: "the content changed since you last loaded it — reload and review it again" };
  }

  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).insert({
    target_kind: target.kind,
    content_item_id: target.kind === "content_item" ? target.id : null,
    blog_draft_id: target.kind === "blog_draft" ? target.id : null,
    due_at: resolved.instant.toISOString(),
    time_zone: resolved.timeZone,
    local_wall_time: formatWallTime(resolved.wall),
    source_revision: ready.target.revision,
  }).select(SCHEDULE_COLUMNS).single();
  if (error) {
    if (error.code === "23505") {
      const existing = await activeScheduleFor(client, target);
      return { outcome: "conflict", message: "this content already has a schedule — reschedule or cancel it instead", schedule: existing ?? undefined };
    }
    throw new Error(`could not create schedule: ${error.message}`);
  }
  return { outcome: "ok", schedule: data as unknown as PublicationScheduleDto };
}

// Explains why a guarded update matched nothing, from the row's current state.
async function explainMiss(client: SupabaseClient, id: string, version: number): Promise<ScheduleMutationResult> {
  const row = await loadSchedule(client, id);
  if (!row) return { outcome: "not_found" };
  const dto = toScheduleDto(row);
  if (row.state === "published") return { outcome: "already_published", schedule: dto };
  if (row.schedule_version !== version) {
    return { outcome: "conflict", message: "this schedule was changed from another tab or device — reload to see it", schedule: dto };
  }
  if (row.state === "processing") return { outcome: "conflict", message: "this post is being published right now", schedule: dto };
  if (row.state === "cancelled") return { outcome: "conflict", message: "this schedule was already cancelled", schedule: dto };
  return { outcome: "conflict", message: `schedule is ${row.state}`, schedule: dto };
}

export interface RescheduleArgs { client: SupabaseClient; id: string; version: number; when: ScheduleInput; now?: Date }

export async function reschedule(args: RescheduleArgs): Promise<ScheduleMutationResult> {
  const { client, id, version } = args;
  const resolved = resolveScheduleInstant(args.when, args.now ?? new Date());
  if (!resolved.ok) return { outcome: "invalid", message: resolved.message, code: resolved.code };
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).update({
    due_at: resolved.instant.toISOString(),
    time_zone: resolved.timeZone,
    local_wall_time: formatWallTime(resolved.wall),
    schedule_version: version + 1,
    state: "queued", attempts: 0, next_attempt_at: null, last_error: null,
  }).eq("id", id).eq("schedule_version", version).in("state", [...RESCHEDULABLE_STATES]).select(SCHEDULE_COLUMNS);
  if (error) throw new Error(`could not reschedule: ${error.message}`);
  if (!data?.length) return explainMiss(client, id, version);
  return { outcome: "ok", schedule: data[0] as unknown as PublicationScheduleDto };
}

/** Cancels a schedule that has not committed. A processing row may be cancelled too: the commit RPC then refuses it. */
export async function cancelSchedule(client: SupabaseClient, id: string, version: number, reason = "cancelled by admin"): Promise<ScheduleMutationResult> {
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).update({
    state: "cancelled", schedule_version: version + 1, last_error: reason.slice(0, 2000),
    next_attempt_at: null, claim_token: null, lease_expires_at: null,
  }).eq("id", id).eq("schedule_version", version).in("state", ["queued", "blocked", "failed", "processing"]).select(SCHEDULE_COLUMNS);
  if (error) throw new Error(`could not cancel: ${error.message}`);
  if (!data?.length) return explainMiss(client, id, version);
  return { outcome: "ok", schedule: data[0] as unknown as PublicationScheduleDto };
}

/** Blocked/failed → queued again at the same due time (overdue work publishes on the next tick). */
export async function retrySchedule(client: SupabaseClient, id: string, version: number): Promise<ScheduleMutationResult> {
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE).update({
    state: "queued", schedule_version: version + 1, attempts: 0, next_attempt_at: null, last_error: null,
  }).eq("id", id).eq("schedule_version", version).in("state", ["blocked", "failed"]).select(SCHEDULE_COLUMNS);
  if (error) throw new Error(`could not retry: ${error.message}`);
  if (!data?.length) return explainMiss(client, id, version);
  return { outcome: "ok", schedule: data[0] as unknown as PublicationScheduleDto };
}

/** Takes the publish-now claim; the caller then runs the publisher with the returned token. */
export async function claimScheduleNow(client: SupabaseClient, id: string, version: number):
  Promise<{ outcome: "claimed"; row: PublicationScheduleRow } | ScheduleMutationResult> {
  const { data, error } = await client.rpc("claim_publication_schedule_now", {
    p_schedule_id: id, p_schedule_version: version, p_lease_seconds: WORKER_LEASE_SECONDS,
  });
  if (error) throw new Error(`could not claim schedule: ${error.message}`);
  const rows = (data ?? []) as PublicationScheduleRow[];
  if (rows.length === 0) return explainMiss(client, id, version);
  return { outcome: "claimed", row: rows[0] };
}

/**
 * Cancels the active, not-yet-processing schedules of an edited/rejected item.
 * A row already being processed is left to the commit RPC, which refuses the
 * changed revision and reports it as blocked with the reason.
 */
export async function cancelActiveSchedulesForItem(client: SupabaseClient, itemId: string, reason: string): Promise<number> {
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE)
    .update({ state: "cancelled", last_error: reason.slice(0, 2000), next_attempt_at: null })
    .eq("content_item_id", itemId).in("state", ["queued", "blocked", "failed"]).select("id");
  if (error) {
    if (missingTable(error)) return 0;
    throw new Error(`could not cancel schedules: ${error.message}`);
  }
  return data?.length ?? 0;
}

export async function cancelActiveSchedulesForDraft(client: SupabaseClient, draftId: string, reason: string): Promise<number> {
  const { data, error } = await client.from(PUBLICATION_SCHEDULES_TABLE)
    .update({ state: "cancelled", last_error: reason.slice(0, 2000), next_attempt_at: null })
    .eq("blog_draft_id", draftId).in("state", ["queued", "blocked", "failed"]).select("id");
  if (error) {
    if (missingTable(error)) return 0;
    throw new Error(`could not cancel schedules: ${error.message}`);
  }
  return data?.length ?? 0;
}
