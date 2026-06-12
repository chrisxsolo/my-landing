// Server-side event recording (spec §10). Attribution rules: ONLY an explicit
// live-target identity resolves to an item/session (via the indexed reverse
// lookup on (published_target_type, published_target_id) — never content_id
// alone); shared pages store nulls; cta_click attributes to the page, never a
// session. Server timestamps only — content_events.viewed_at defaults to now().
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeEventPath, normalizeReferrer,
  TRACKED_EVENT_TYPES, TRACKED_CONTENT_TYPES, type TrackedEventType,
} from "@/lib/contentEngine/trackEventRules";

export interface TrackEventInput {
  event: string;
  path: string;
  contentType: string | null;
  contentId: string | null;
  referrer: string;
  target: { type: string; id: string } | null;
}

export interface RecordResult {
  recorded: boolean;
  reason?: string;
}

async function resolveAttribution(
  client: SupabaseClient, target: { type: string; id: string },
): Promise<{ contentItemId: string; sessionId: string } | null> {
  const { data: item } = await client
    .from("session_content_items")
    .select("id,package_id")
    .eq("published_target_type", target.type)
    .eq("published_target_id", target.id)
    .maybeSingle();
  if (!item) return null;
  const { data: pkg } = await client
    .from("session_content_packages")
    .select("photography_session_id").eq("id", item.package_id).single();
  return { contentItemId: item.id as string, sessionId: pkg!.photography_session_id as string };
}

export async function recordContentEvent(
  client: SupabaseClient, input: TrackEventInput,
): Promise<RecordResult> {
  if (!(TRACKED_EVENT_TYPES as readonly string[]).includes(input.event)) {
    return { recorded: false, reason: "event type not tracked" };
  }
  const path = normalizeEventPath(input.path);
  if (!path) return { recorded: false, reason: "unknown path" };
  if (input.contentType !== null
      && !(TRACKED_CONTENT_TYPES as readonly string[]).includes(input.contentType)) {
    return { recorded: false, reason: "content type not tracked" };
  }

  // attribution: single-session content only, never for CTA clicks (spec §10)
  let attribution: { contentItemId: string; sessionId: string } | null = null;
  if (input.event !== "cta_click" && input.target?.type && input.target.id) {
    attribution = await resolveAttribution(client, input.target);
  }

  const { error } = await client.from("content_events").insert({
    event_type: input.event as TrackedEventType,
    path,
    referrer_domain: normalizeReferrer(input.referrer),
    content_type: input.contentType,
    content_id: input.contentId === null ? null : String(input.contentId).slice(0, 120),
    photography_session_id: attribution?.sessionId ?? null,
    content_item_id: attribution?.contentItemId ?? null,
  });
  if (error) {
    console.error("content event insert failed:", error.message);
    return { recorded: false, reason: "insert failed" };
  }
  return { recorded: true };
}
