// ─────────────────────────────────────────────────────────────────────────────
// lib/inquiryAutoRefresh.ts
//
// Planning logic for the cheap inquiry refresh that runs when the Darkroom
// dashboard opens. The full reconciliation in lib/inquiryReconcileGmail.ts asks
// Gmail about every inquiry one at a time (one search + one fetch per message,
// per inquiry) — far too expensive to run on page load. This inverts it:
//
//   one windowed search across all client addresses → fetch only the few
//   messages in that window → reconcile only the inquiries they touch.
//
// Cost on a quiet open is a couple of Gmail list calls and no message fetches,
// regardless of how many inquiries exist. Partial message sets are safe because
// computeInquiryReconciliation treats stored timestamps as evidence and never
// walks state backwards.
//
// Pure module — no I/O, no AI. The route wiring lives in
// app/api/admin/inquiries/refresh/route.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeEmail, type ReconcileMessage } from "@/lib/inquiryReconcile";

/** site_settings key holding the epoch-ms instant of the last successful refresh. */
export const INQUIRY_REFRESH_CURSOR_KEY = "inquiry_refresh_cursor";

/** Opening the dashboard twice in a minute does not re-ask Gmail. */
export const REFRESH_COOLDOWN_MS = 60_000;
/** How far back a first run (or a long-stale cursor) looks. */
export const REFRESH_MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-scan slightly before the cursor so a message racing the last run is not missed. */
export const REFRESH_OVERLAP_MS = 10 * 60 * 1000;
/** Addresses per Gmail query — keeps each query string well inside Gmail's limit. */
export const ADDRESSES_PER_QUERY = 20;
/** Hard ceiling on message metadata fetches for one refresh. */
export const MAX_MESSAGES_PER_REFRESH = 120;
/**
 * A conversation with no activity this long is not scanned on open — new mail
 * on a months-dead inquiry is rare, and the manual Sync Timeline still covers
 * every row. Keeps the query count low as the inquiries table grows.
 */
export const REFRESH_ACTIVE_WINDOW_MS = 120 * 24 * 60 * 60 * 1000;

/** Statuses whose disposition is final — never scanned, never changed on open. */
const CLOSED_STATUSES = new Set(["archived", "not_interested", "manual"]);

type RefreshCandidate = {
  status: string;
  created_at: string;
  last_message_at: string | null;
};

/**
 * The inquiries worth asking Gmail about on a dashboard open: live
 * dispositions with activity inside the active window.
 */
export function selectRefreshCandidates<T extends RefreshCandidate>(rows: T[], nowMs: number): T[] {
  const floor = nowMs - REFRESH_ACTIVE_WINDOW_MS;
  return rows.filter(row => {
    if (CLOSED_STATUSES.has(row.status)) return false;
    const activity = Math.max(
      Date.parse(row.last_message_at ?? "") || 0,
      Date.parse(row.created_at) || 0,
    );
    // An unparseable/missing date is not a reason to drop a live inquiry.
    return activity === 0 || activity >= floor;
  });
}

/**
 * Start of the window this refresh should scan: a little before the stored
 * cursor, never further back than the lookback cap.
 */
export function refreshWindowStart(cursorMs: number | null, nowMs: number): number {
  const floor = nowMs - REFRESH_MAX_LOOKBACK_MS;
  if (cursorMs === null) return floor;
  return Math.max(floor, cursorMs - REFRESH_OVERLAP_MS);
}

/** True when the last refresh is recent enough that asking Gmail again is waste. */
export function withinCooldown(cursorMs: number | null, nowMs: number): boolean {
  return cursorMs !== null && nowMs - cursorMs < REFRESH_COOLDOWN_MS && nowMs >= cursorMs;
}

/**
 * Gmail search queries covering every inquiry address inside the window.
 * Gmail does the matching server-side, so unrelated mail never costs a fetch.
 */
export function buildRefreshQueries(
  clientEmails: string[],
  sinceMs: number,
  chunkSize = ADDRESSES_PER_QUERY,
): string[] {
  const unique = [...new Set(
    clientEmails.map(normalizeEmail).filter(email => email.includes("@")),
  )].sort();
  if (!unique.length) return [];

  // Gmail's `after:` takes epoch seconds; floor so the boundary is inclusive.
  const after = Math.floor(sinceMs / 1000);
  const queries: string[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const clause = unique
      .slice(i, i + chunkSize)
      .map(email => `from:${email} OR to:${email} OR cc:${email}`)
      .join(" OR ");
    queries.push(`after:${after} AND (${clause})`);
  }
  return queries;
}

/**
 * Attributes each scanned message to the inquiries it belongs to: inbound by
 * sender, outbound by recipient. A message addressed to nobody we track is
 * dropped rather than guessed at, and one client with several inquiries gets
 * the message on each of them (the same thing a per-inquiry scan would do).
 */
export function groupMessagesByInquiry<T extends { id: number; email: string }>(
  inquiries: T[],
  messages: ReconcileMessage[],
): Map<number, ReconcileMessage[]> {
  const byAddress = new Map<string, number[]>();
  for (const inquiry of inquiries) {
    const address = normalizeEmail(inquiry.email);
    if (!address.includes("@")) continue;
    byAddress.set(address, [...(byAddress.get(address) ?? []), inquiry.id]);
  }

  const grouped = new Map<number, ReconcileMessage[]>();
  for (const message of messages) {
    const addresses = message.direction === "inbound"
      ? [normalizeEmail(message.fromEmail)]
      : (message.participants ?? []).map(normalizeEmail);
    const matched = new Set<number>();
    for (const address of addresses) {
      for (const id of byAddress.get(address) ?? []) matched.add(id);
    }
    for (const id of matched) {
      grouped.set(id, [...(grouped.get(id) ?? []), message]);
    }
  }
  return grouped;
}
