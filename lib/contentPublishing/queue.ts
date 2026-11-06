// The upcoming-queue read: every schedule decorated with what it publishes
// (title, type, where it is edited, live URL) so the admin list needs one call.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTENT_TYPE_LABELS } from "@/lib/contentEngine/contentTypeLabels";
import {
  BLOG_POST_DRAFTS_TABLE, OVERDUE_GRACE_SECONDS, PUBLICATION_SCHEDULES_TABLE, type ScheduleState,
} from "@/lib/contentPublishing/constants";
import { SCHEDULE_COLUMNS, type PublicationScheduleDto, type ScheduleQueueEntry } from "@/lib/contentPublishing/types";

const ITEMS_TABLE = "session_content_items";
const PACKAGES_TABLE = "session_content_packages";
const SESSIONS_TABLE = "photography_sessions";

interface ItemInfo { title: string; typeLabel: string; slug: string | null; sessionId: string | null; sessionName: string | null; contentType: string }

async function itemInfos(client: SupabaseClient, ids: string[]): Promise<Map<string, ItemInfo>> {
  if (ids.length === 0) return new Map();
  const { data: items, error } = await client.from(ITEMS_TABLE).select("id,content_type,payload,package_id").in("id", ids);
  if (error) throw new Error(`could not load items: ${error.message}`);
  const pkgIds = [...new Set((items ?? []).map((i) => i.package_id as string))];
  const { data: pkgs } = pkgIds.length
    ? await client.from(PACKAGES_TABLE).select("id,photography_session_id").in("id", pkgIds) : { data: [] };
  const sessionIds = [...new Set((pkgs ?? []).map((p) => p.photography_session_id as string))];
  const { data: sessions } = sessionIds.length
    ? await client.from(SESSIONS_TABLE).select("id,public_display_name").in("id", sessionIds) : { data: [] };
  const sessionOfPkg = new Map((pkgs ?? []).map((p) => [p.id as string, p.photography_session_id as string]));
  const nameOfSession = new Map((sessions ?? []).map((s) => [s.id as string, (s.public_display_name as string | null) ?? null]));
  return new Map((items ?? []).map((i) => {
    const payload = (i.payload ?? {}) as Record<string, unknown>;
    const sessionId = sessionOfPkg.get(i.package_id as string) ?? null;
    const title = typeof payload.title === "string" && payload.title ? payload.title
      : typeof payload.alt_text === "string" && payload.alt_text ? payload.alt_text
      : CONTENT_TYPE_LABELS[i.content_type as string] ?? (i.content_type as string);
    return [i.id as string, {
      title, contentType: i.content_type as string,
      typeLabel: CONTENT_TYPE_LABELS[i.content_type as string] ?? (i.content_type as string),
      slug: typeof payload.slug === "string" ? payload.slug : null,
      sessionId, sessionName: sessionId ? nameOfSession.get(sessionId) ?? null : null,
    }];
  }));
}

async function draftInfos(client: SupabaseClient, ids: string[]): Promise<Map<string, { title: string; slug: string }>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from(BLOG_POST_DRAFTS_TABLE).select("id,title,slug").in("id", ids);
  if (error) throw new Error(`could not load drafts: ${error.message}`);
  return new Map((data ?? []).map((d) => [d.id as string, { title: (d.title as string) || "Untitled draft", slug: d.slug as string }]));
}

export interface ListQueueArgs { client: SupabaseClient; states?: ScheduleState[]; limit?: number; now?: Date }

export async function listScheduleQueue(args: ListQueueArgs): Promise<ScheduleQueueEntry[]> {
  const { client } = args;
  const now = args.now ?? new Date();
  let query = client.from(PUBLICATION_SCHEDULES_TABLE).select(SCHEDULE_COLUMNS).order("due_at", { ascending: true }).limit(args.limit ?? 200);
  if (args.states?.length) query = query.in("state", args.states);
  const { data, error } = await query;
  if (error) throw new Error(`could not list schedules: ${error.message}`);
  const rows = (data ?? []) as unknown as PublicationScheduleDto[];
  const [items, drafts] = await Promise.all([
    itemInfos(client, rows.map((r) => r.content_item_id).filter((id): id is string => !!id)),
    draftInfos(client, rows.map((r) => r.blog_draft_id).filter((id): id is string => !!id)),
  ]);
  const graceMs = OVERDUE_GRACE_SECONDS * 1000;
  return rows.map((schedule) => {
    // A row waiting out a retry back-off is retrying, not overdue.
    const waitingRetry = schedule.next_attempt_at !== null && Date.parse(schedule.next_attempt_at) > now.getTime();
    const overdue = schedule.state === "queued" && !waitingRetry && Date.parse(schedule.due_at) + graceMs < now.getTime();
    if (schedule.target_kind === "blog_draft") {
      const d = drafts.get(schedule.blog_draft_id as string);
      return {
        schedule, title: d?.title ?? "Deleted draft", typeLabel: "Blog post (draft)", source: { kind: "blog_draft" },
        liveUrl: schedule.state === "published" && d?.slug ? `/blog/${d.slug}` : null, overdue,
      };
    }
    const i = items.get(schedule.content_item_id as string);
    const liveUrl = schedule.state === "published" && i?.contentType === "journal_post" && i.slug ? `/blog/${i.slug}` : null;
    return {
      schedule, title: i?.title ?? "Deleted item", typeLabel: i?.typeLabel ?? "Content item",
      source: { kind: "content_item", sessionId: i?.sessionId ?? null, sessionName: i?.sessionName ?? null }, liveUrl, overdue,
    };
  });
}
