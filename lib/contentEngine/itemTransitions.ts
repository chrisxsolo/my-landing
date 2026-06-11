// Item editing + review-state machines (spec §7.4). Autosave uses
// payload_revision optimistic concurrency: a stale revision returns the server
// copy for the editor's comparison prompt. Editing an approved item reverts it
// to draft — approval reviews specific content, so changed content needs
// re-review. Published/publishing items are immutable here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePayload } from "@/lib/contentEngine/payloads";

const EDITABLE_STATUSES = ["draft", "approved", "failed"] as const;

export interface AutosaveArgs {
  client: SupabaseClient;
  itemId: string;
  payload: unknown;
  expectedRevision: number;
}

interface AutosaveServerCopy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  payload_revision: number;
  status: string;
}

export type AutosaveResult =
  | { outcome: "saved"; payloadRevision: number; statusReset: boolean }
  | { outcome: "conflict"; server: AutosaveServerCopy }
  | { outcome: "invalid"; message: string }
  | { outcome: "not_found" }
  | { outcome: "not_editable"; status: string };

export async function applyAutosave(args: AutosaveArgs): Promise<AutosaveResult> {
  const { client, itemId, payload, expectedRevision } = args;

  const { data: item } = await client.from("session_content_items")
    .select("id,content_type,status,payload,payload_revision").eq("id", itemId).maybeSingle();
  if (!item) return { outcome: "not_found" };
  if (!(EDITABLE_STATUSES as readonly string[]).includes(item.status)) {
    return { outcome: "not_editable", status: item.status };
  }

  const validated = validatePayload(item.content_type, payload);
  if (!validated.success) {
    return { outcome: "invalid", message: validated.error.message };
  }

  const statusReset = item.status === "approved";
  const { data: updated, error } = await client.from("session_content_items")
    .update({
      payload: validated.data,
      payload_revision: expectedRevision + 1,
      ...(statusReset ? { status: "draft", approved_at: null, approved_by: null } : {}),
    })
    .eq("id", itemId)
    .eq("payload_revision", expectedRevision)
    .select("payload_revision");
  if (error) throw new Error(`autosave failed: ${error.message}`);

  if (!updated || updated.length === 0) {
    const { data: server } = await client.from("session_content_items")
      .select("payload,payload_revision,status").eq("id", itemId).single();
    return { outcome: "conflict", server: server as AutosaveServerCopy };
  }
  return { outcome: "saved", payloadRevision: updated[0].payload_revision as number, statusReset };
}

export type StatusAction = "approve" | "reject" | "unreject";

export interface StatusActionArgs {
  client: SupabaseClient;
  itemId: string;
  action: StatusAction;
  reason?: string | null;
}

export type StatusActionResult =
  | { outcome: "done"; status: string }
  | { outcome: "forbidden"; message: string }
  | { outcome: "not_found" };

const ALLOWED_FROM: Record<StatusAction, string[]> = {
  approve: ["draft", "failed"],
  reject: ["draft", "approved", "failed"],
  unreject: ["rejected"],
};

export async function applyStatusAction(args: StatusActionArgs): Promise<StatusActionResult> {
  const { client, itemId, action, reason } = args;
  const allowed = ALLOWED_FROM[action];
  if (!allowed) return { outcome: "forbidden", message: `unknown action ${String(action)}` };

  const { data: item } = await client.from("session_content_items")
    .select("id,status").eq("id", itemId).maybeSingle();
  if (!item) return { outcome: "not_found" };
  if (!allowed.includes(item.status)) {
    return { outcome: "forbidden", message: `cannot ${action} from status ${item.status}` };
  }

  const now = new Date().toISOString();
  const patch =
    action === "approve"
      ? { status: "approved", approved_at: now, approved_by: "admin", error: null,
          rejected_at: null, rejection_reason: null }
      : action === "reject"
        ? { status: "rejected", rejected_at: now, rejection_reason: reason?.slice(0, 1000) ?? null,
            approved_at: null, approved_by: null }
        : { status: "draft", rejected_at: null, rejection_reason: null };

  const { error } = await client.from("session_content_items")
    .update(patch).eq("id", itemId).eq("status", item.status);
  if (error) throw new Error(`status action failed: ${error.message}`);
  return { outcome: "done", status: patch.status };
}
