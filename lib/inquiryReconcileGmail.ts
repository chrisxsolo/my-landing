// ─────────────────────────────────────────────────────────────────────────────
// lib/inquiryReconcileGmail.ts
//
// Gmail layer for inquiry reply-status reconciliation. For each inquiry it
// searches ALL mail (sent + inbox + archive) where the client's address is in
// From/To/Cc/Bcc, plus any threads already linked to the inquiry, classifies
// each message inbound/outbound against the connected account's addresses, and
// persists the derived state via lib/inquiryReconcile.ts.
//
// Only metadata (headers, timestamps, thread ids) is fetched — never bodies —
// and logs contain ids/timestamps only, never email content.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeInquiryReconciliation,
  isOutboundMessage,
  normalizeEmail,
  INQUIRY_STATUS,
  type ReconcileInquirySnapshot,
  type ReconcileMessage,
} from "@/lib/inquiryReconcile";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const INQUIRIES_TABLE = "inquiries";
const MAX_MESSAGES_PER_INQUIRY = 50;
const INQUIRY_CONCURRENCY = 4;
// Metadata lookups per inquiry run in small batches — 50 at once (× concurrent
// inquiries) trips Gmail's per-user rate limit and silently drops messages.
const META_FETCH_CONCURRENCY = 10;

const RECONCILE_SELECT = [
  "id", "email", "status", "status_source", "created_at", "reply_sent_at",
  "invoice_sent_at", "contract_sent_at", "deposit_paid_at", "confirmation_sent_at",
  "gallery_delivered_at", "booking_confirmed", "payment_status", "needs_reply",
  "needs_reply_dismissed_at", "last_inbound_at", "last_outbound_at",
  "last_message_at", "last_message_direction", "gmail_thread_ids",
].join(",");

type ReconcileRow = {
  id: number;
  email: string;
  status: string;
  status_source: string | null;
  created_at: string;
  reply_sent_at: string | null;
  invoice_sent_at: string | null;
  contract_sent_at: string | null;
  deposit_paid_at: string | null;
  confirmation_sent_at: string | null;
  gallery_delivered_at: string | null;
  booking_confirmed: boolean | null;
  payment_status: string | null;
  needs_reply: boolean | null;
  needs_reply_dismissed_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  gmail_thread_ids: string[] | null;
};

type GmailMetaMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

export type ReconcileSummary = {
  processed: number;
  updated: number;
  unchanged: number;
  statusRepaired: number;
  failed: number;
  changes: { id: number; email: string; previousStatus: string; nextStatus: string; needsReply: boolean }[];
};

function toSnapshot(row: ReconcileRow): ReconcileInquirySnapshot {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    statusSource: row.status_source,
    createdAt: row.created_at,
    replySentAt: row.reply_sent_at,
    invoiceSentAt: row.invoice_sent_at,
    contractSentAt: row.contract_sent_at,
    depositPaidAt: row.deposit_paid_at,
    confirmationSentAt: row.confirmation_sent_at,
    galleryDeliveredAt: row.gallery_delivered_at,
    bookingConfirmed: row.booking_confirmed,
    paymentStatus: row.payment_status,
    needsReply: row.needs_reply,
    needsReplyDismissedAt: row.needs_reply_dismissed_at,
    lastInboundAt: row.last_inbound_at,
    lastOutboundAt: row.last_outbound_at,
    lastMessageAt: row.last_message_at,
    lastMessageDirection: row.last_message_direction,
    gmailThreadIds: row.gmail_thread_ids,
  };
}

/** Connected account address plus any Gmail send-as aliases. */
export async function getConnectedAccountEmails(
  auth: string,
  fallbackEmail?: string | null,
): Promise<string[]> {
  const emails = new Set<string>();
  if (fallbackEmail?.includes("@")) emails.add(normalizeEmail(fallbackEmail));
  try {
    const res = await fetch(`${GMAIL_API}/profile`, { headers: { Authorization: auth } });
    if (res.ok) {
      const json = await res.json() as { emailAddress?: string };
      if (json.emailAddress) emails.add(normalizeEmail(json.emailAddress));
    }
  } catch (error) {
    console.error("[inquiry-reconcile] profile lookup failed:", error);
  }
  try {
    const res = await fetch(`${GMAIL_API}/settings/sendAs`, { headers: { Authorization: auth } });
    if (res.ok) {
      const json = await res.json() as { sendAs?: { sendAsEmail?: string }[] };
      for (const alias of json.sendAs ?? []) {
        if (alias.sendAsEmail) emails.add(normalizeEmail(alias.sendAsEmail));
      }
    }
  } catch {
    // sendAs needs an extra scope on some connections — the profile address is enough.
  }
  return [...emails];
}

async function fetchMessageMeta(auth: string, id: string): Promise<GmailMetaMessage | null> {
  try {
    const res = await fetch(
      `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`,
      { headers: { Authorization: auth } },
    );
    if (!res.ok) return null;
    return await res.json() as GmailMetaMessage;
  } catch { return null; }
}

/**
 * All messages involving the client address (any label — sent replies live
 * under SENT, not the inbox) plus messages from already-linked threads.
 */
async function fetchInquiryMessages(
  auth: string,
  clientEmail: string,
  knownThreadIds: string[],
  connectedEmails: string[],
): Promise<ReconcileMessage[]> {
  const email = normalizeEmail(clientEmail);
  const query = `from:(${email}) OR to:(${email}) OR cc:(${email}) OR bcc:(${email})`;
  const ids = new Set<string>();

  const listRes = await fetch(
    `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_MESSAGES_PER_INQUIRY}`,
    { headers: { Authorization: auth } },
  );
  // A failed search (expired token, rate limit) must fail the row — silently
  // reconciling against an empty message set would report success on stale data.
  if (!listRes.ok) throw new Error(`Gmail message search failed (${listRes.status})`);
  const json = await listRes.json() as { messages?: { id: string }[] };
  for (const m of json.messages ?? []) ids.add(m.id);

  // Threads linked in a previous run can contain messages the address search
  // misses (e.g. the client switched addresses mid-thread).
  const seenThreads = new Set<string>();
  const metas: GmailMetaMessage[] = [];
  for (const threadId of knownThreadIds) {
    if (seenThreads.has(threadId)) continue;
    seenThreads.add(threadId);
    try {
      const res = await fetch(
        `${GMAIL_API}/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`,
        { headers: { Authorization: auth } },
      );
      if (!res.ok) continue;
      const json = await res.json() as { messages?: GmailMetaMessage[] };
      for (const msg of json.messages ?? []) {
        if (!ids.has(msg.id)) metas.push(msg);
      }
    } catch { continue; }
  }

  const idList = [...ids];
  for (let i = 0; i < idList.length; i += META_FETCH_CONCURRENCY) {
    const fetched = await Promise.all(
      idList.slice(i, i + META_FETCH_CONCURRENCY).map(id => fetchMessageMeta(auth, id)),
    );
    metas.push(...fetched.filter((m): m is GmailMetaMessage => m !== null));
  }

  const messages: ReconcileMessage[] = [];
  for (const meta of metas) {
    const headers = meta.payload?.headers ?? [];
    const fromRaw = headers.find(h => h.name.toLowerCase() === "from")?.value ?? "";
    const fromEmail = normalizeEmail(fromRaw);
    if (!fromEmail.includes("@")) continue;
    const at = meta.internalDate ? new Date(parseInt(meta.internalDate, 10)).toISOString() : null;
    if (!at) continue;

    // Classify strictly: outbound = from the connected account, inbound = from
    // the client. Third-party mail in the thread (payment processors, e-sign
    // bots) must not count as either side of the conversation.
    const outbound = isOutboundMessage({ fromEmail }, connectedEmails);
    if (!outbound && fromEmail !== email) continue;
    messages.push({
      id: meta.id,
      threadId: meta.threadId ?? null,
      at,
      fromEmail,
      direction: outbound ? "outbound" : "inbound",
    });
  }
  return messages;
}

/**
 * Reconciles every inquiry's reply state against Gmail and persists rows whose
 * derived state changed. Archived / not-interested inquiries skip the Gmail
 * search (their status is protected and they need no reply either way).
 */
export async function reconcileInquiriesWithGmail(
  supabase: SupabaseClient,
  auth: string,
  connectedEmails: string[],
  options: { inquiryId?: number } = {},
): Promise<ReconcileSummary> {
  let select = supabase.from(INQUIRIES_TABLE).select(RECONCILE_SELECT).limit(2000);
  if (options.inquiryId) select = select.eq("id", options.inquiryId);
  const { data, error } = await select.returns<ReconcileRow[]>();
  if (error) throw error;
  const rows = data ?? [];

  const summary: ReconcileSummary = {
    processed: 0, updated: 0, unchanged: 0, statusRepaired: 0, failed: 0, changes: [],
  };

  const closed = new Set<string>([INQUIRY_STATUS.ARCHIVED, INQUIRY_STATUS.NOT_INTERESTED]);
  for (let i = 0; i < rows.length; i += INQUIRY_CONCURRENCY) {
    const batch = rows.slice(i, i + INQUIRY_CONCURRENCY);
    await Promise.all(batch.map(async row => {
      summary.processed++;
      try {
        const messages = closed.has(row.status)
          ? []
          : await fetchInquiryMessages(auth, row.email, row.gmail_thread_ids ?? [], connectedEmails);
        const result = computeInquiryReconciliation(toSnapshot(row), messages);
        console.log("[timeline-sync] inquiry reconciliation", result.debug);
        if (!result.changed) { summary.unchanged++; return; }

        const { error: updateError } = await supabase
          .from(INQUIRIES_TABLE)
          .update(result.updates)
          .eq("id", row.id);
        if (updateError) throw updateError;

        summary.updated++;
        if (result.nextStatus !== row.status) summary.statusRepaired++;
        summary.changes.push({
          id: row.id,
          email: normalizeEmail(row.email),
          previousStatus: row.status,
          nextStatus: result.nextStatus,
          needsReply: result.needsReply,
        });
      } catch (error) {
        summary.failed++;
        console.error(`[timeline-sync] reconciliation failed for inquiry ${row.id}:`, error);
      }
    }));
  }
  return summary;
}
