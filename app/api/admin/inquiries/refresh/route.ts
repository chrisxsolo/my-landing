// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/inquiries/refresh
//
// The cheap, automatic counterpart to "Sync Timeline". The dashboard calls this
// when it opens so a reply sent straight from Gmail turns the card blue (and a
// client's answer turns it amber) without anyone remembering to press a button.
//
// Deliberately narrow — inquiry reply state only. It does ONE windowed Gmail
// search across all client addresses, fetches metadata for just the messages in
// that window, and reconciles only the inquiries those messages touch. A quiet
// open costs a couple of list calls and zero message fetches. No AI, no bodies,
// no per-card requests. The heavyweight full history pass (and the AI milestone
// scan) still lives behind the manual Sync Timeline button.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getValidTokens } from "@/lib/gmailTokens";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { computeInquiryReconciliation } from "@/lib/inquiryReconcile";
import {
  buildRefreshQueries,
  groupMessagesByInquiry,
  INQUIRY_REFRESH_CURSOR_KEY,
  MAX_MESSAGES_PER_REFRESH,
  refreshWindowStart,
  selectRefreshCandidates,
  withinCooldown,
} from "@/lib/inquiryAutoRefresh";
import {
  fetchMessageMetaBatch,
  getConnectedAccountEmails,
  RECONCILE_SELECT,
  toReconcileMessages,
  toSnapshot,
  type ReconcileRow,
} from "@/lib/inquiryReconcileGmail";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SETTINGS_TABLE = "site_settings";
const INQUIRIES_TABLE = "inquiries";
const INQUIRY_ROW_LIMIT = 2000;

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

async function readCursor(supabase: SupabaseAdmin): Promise<number | null> {
  const { data } = await supabase
    .from(SETTINGS_TABLE)
    .select("value")
    .eq("key", INQUIRY_REFRESH_CURSOR_KEY)
    .maybeSingle();
  const parsed = Number(data?.value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function writeCursor(supabase: SupabaseAdmin, atMs: number): Promise<void> {
  await supabase.from(SETTINGS_TABLE).upsert(
    { key: INQUIRY_REFRESH_CURSOR_KEY, value: String(atMs), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

/** Message ids matching any of the windowed address queries. */
async function searchWindow(auth: string, queries: string[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const query of queries) {
    const res = await fetch(
      `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=100`,
      { headers: { Authorization: auth } },
    );
    // A degraded search must not look like "nothing happened" — leave the
    // cursor where it is so the next open retries the same window.
    if (!res.ok) throw new Error(`Gmail refresh search failed (${res.status})`);
    const json = await res.json() as { messages?: { id: string }[] };
    for (const message of json.messages ?? []) ids.add(message.id);
  }
  return [...ids];
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const tokens = await getValidTokens();
  // Not connected is a normal state on page load, not an error to toast.
  if (!tokens) return NextResponse.json({ connected: false, skipped: "gmail-not-connected", updated: 0 });

  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const cursor = await readCursor(supabase);
  if (withinCooldown(cursor, now)) {
    return NextResponse.json({ connected: true, skipped: "cooldown", updated: 0 });
  }

  const { data, error } = await supabase
    .from(INQUIRIES_TABLE)
    .select(RECONCILE_SELECT)
    .limit(INQUIRY_ROW_LIMIT)
    .returns<ReconcileRow[]>();
  if (error) {
    console.error("[inquiry-refresh] failed to load inquiries:", error);
    return NextResponse.json({ error: "Failed to load inquiries." }, { status: 500 });
  }
  // Archived / not-interested rows and long-dead conversations are skipped, so
  // the query count stays flat as the table grows.
  const rows = selectRefreshCandidates(data ?? [], now);
  if (!rows.length) {
    await writeCursor(supabase, now);
    return NextResponse.json({ connected: true, updated: 0, inspected: 0, queries: 0 });
  }

  const auth = `Bearer ${tokens.access_token}`;
  const windowStart = refreshWindowStart(cursor, now);
  const queries = buildRefreshQueries(rows.map(row => row.email), windowStart);

  try {
    const ids = await searchWindow(auth, queries);
    if (!ids.length) {
      // Nothing arrived in the window — no metadata fetches, no writes.
      await writeCursor(supabase, now);
      return NextResponse.json({ connected: true, updated: 0, inspected: 0, queries: queries.length });
    }

    // Newest first from Gmail, so the cap keeps the most recent activity.
    const capped = ids.slice(0, MAX_MESSAGES_PER_REFRESH);
    const connectedEmails = await getConnectedAccountEmails(auth, tokens.email);
    const metas = await fetchMessageMetaBatch(auth, capped);
    const messages = toReconcileMessages(metas, rows.map(row => row.email), connectedEmails);
    const grouped = groupMessagesByInquiry(rows, messages);

    let updated = 0;
    let statusRepaired = 0;
    for (const row of rows) {
      const scanned = grouped.get(row.id);
      if (!scanned?.length) continue;
      const result = computeInquiryReconciliation(toSnapshot(row), scanned);
      if (!result.changed) continue;
      const { error: updateError } = await supabase
        .from(INQUIRIES_TABLE)
        .update(result.updates)
        .eq("id", row.id);
      if (updateError) {
        // One bad row must not sink the pass or the cursor.
        console.error(`[inquiry-refresh] update failed for inquiry ${row.id}:`, updateError);
        continue;
      }
      updated++;
      if (result.nextStatus !== row.status) statusRepaired++;
    }

    await writeCursor(supabase, now);
    return NextResponse.json({
      connected: true,
      updated,
      statusRepaired,
      inspected: capped.length,
      queries: queries.length,
      truncated: ids.length > capped.length,
    });
  } catch (error) {
    console.error("[inquiry-refresh] failed:", error);
    // Cursor untouched: the next open rescans this window rather than skipping it.
    return NextResponse.json({ error: "Inquiry refresh failed." }, { status: 502 });
  }
}
