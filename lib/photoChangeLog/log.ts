// Server-only: writes and reads photo_change_log. A failed log write is
// reported with console.error and never blocks the change it describes — the
// change already happened, and a missing history row must not turn a
// successful tag write into a failure.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isChangeActor, PHOTO_CHANGE_LOG_TABLE, type ChangeEntry, type ChangeLogRow,
} from "@/lib/photoChangeLog/entries";

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 200;
const COLUMNS = "id,photo_key,field,old_value,new_value,actor,reason,created_at";

type Row = Record<string, unknown>;

function toRow(r: Row): ChangeLogRow {
  return {
    id: Number(r.id),
    key: String(r.photo_key),
    field: String(r.field),
    oldValue: r.old_value ?? null,
    newValue: r.new_value ?? null,
    actor: isChangeActor(r.actor) ? r.actor : "system",
    reason: typeof r.reason === "string" ? r.reason : null,
    createdAt: String(r.created_at),
  };
}

/** Records the entries. Never throws. */
export async function logChanges(client: SupabaseClient, entries: readonly ChangeEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const { error } = await client.from(PHOTO_CHANGE_LOG_TABLE).insert(entries.map((e) => ({
      photo_key: e.key, field: e.field, old_value: e.oldValue ?? null, new_value: e.newValue ?? null,
      actor: e.actor, reason: e.reason ? e.reason.slice(0, 500) : null,
    })));
    if (error) console.error(`[photo-change-log] could not record ${entries.length} change(s): ${error.message}`);
  } catch (err) {
    console.error(`[photo-change-log] could not record ${entries.length} change(s)`, err);
  }
}

/** Newest first; one photo's (or session's) history when a key is given. */
export async function loadChangeLog(
  client: SupabaseClient, opts: { key?: string; limit?: number } = {},
): Promise<ChangeLogRow[]> {
  const limit = Math.min(Math.max(1, opts.limit ?? HISTORY_LIMIT_DEFAULT), HISTORY_LIMIT_MAX);
  let query = client.from(PHOTO_CHANGE_LOG_TABLE).select(COLUMNS)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (opts.key) query = query.eq("photo_key", opts.key);
  const { data, error } = await query;
  if (error) throw new Error(`could not load the change history: ${error.message}`);
  return ((data ?? []) as Row[]).map(toRow);
}

export async function loadChangeLogRow(client: SupabaseClient, id: number): Promise<ChangeLogRow | null> {
  const { data, error } = await client.from(PHOTO_CHANGE_LOG_TABLE).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`could not load change ${id}: ${error.message}`);
  return data ? toRow(data as Row) : null;
}
