export const INQUIRY_SELECT = [
  "id",
  "name",
  "email",
  "phone",
  "session_type",
  "date_in_mind",
  "message",
  "status",
  "created_at",
  "payment_status",
  "payment_note",
  "payment_detected_at",
  "booking_confirmed",
  "session_date",
  "reply_sent_at",
  "invoice_sent_at",
  "contract_sent_at",
  "deposit_paid_at",
  "gallery_delivered_at",
  "instagram",
  "school",
  "preferred_time",
  "people",
  "location",
  "confirmation_sent_at",
  "needs_reply",
  "needs_reply_dismissed_at",
  "last_inbound_at",
  "last_outbound_at",
  "last_message_at",
  "last_message_direction",
  "status_source",
  "gmail_thread_ids",
].join(",");

export type AdminInquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  session_type: string | null;
  date_in_mind: string | null;
  message: string;
  status: string;
  created_at: string;
  payment_status: string | null;
  payment_note: string | null;
  payment_detected_at: string | null;
  booking_confirmed: boolean | null;
  session_date: string | null;
  reply_sent_at: string | null;
  invoice_sent_at: string | null;
  contract_sent_at: string | null;
  deposit_paid_at: string | null;
  gallery_delivered_at: string | null;
  instagram: string | null;
  school: string | null;
  preferred_time: string | null;
  people: string | null;
  location: string | null;
  confirmation_sent_at: string | null;
  needs_reply: boolean | null;
  needs_reply_dismissed_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  status_source: string | null;
  gmail_thread_ids: string[] | null;
};

// Statuses that never surface in the needs-reply queue.
const NEEDS_REPLY_EXEMPT_STATUSES = new Set(["archived", "not_interested", "manual"]);

/**
 * The conversation state an inquiry card shows. Derived — never stored — so the
 * badge and the card rail can never disagree:
 *
 *  - new            the photographer has never answered this client (green)
 *  - needs_reply    the client wrote the latest message after a previous reply (amber)
 *  - responded      the photographer wrote the latest message (blue)
 *  - archived / not_interested   explicit administrative dispositions
 */
export type InquiryConversationStatus =
  | "new"
  | "needs_reply"
  | "responded"
  | "archived"
  | "not_interested";

type ConversationInquiry = Pick<
  AdminInquiry,
  | "status"
  | "created_at"
  | "needs_reply"
  | "needs_reply_dismissed_at"
  | "reply_sent_at"
  | "invoice_sent_at"
  | "contract_sent_at"
  | "deposit_paid_at"
  | "confirmation_sent_at"
  | "gallery_delivered_at"
  | "booking_confirmed"
  | "payment_status"
  | "last_inbound_at"
  | "last_outbound_at"
  | "last_message_direction"
>;

/** Epoch ms for a timestamp column, tolerating Postgres timestamptz text. */
function instant(value: string | null | undefined): number | null {
  if (!value) return null;
  let ms = Date.parse(value);
  if (Number.isNaN(ms)) ms = Date.parse(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(ms) ? null : ms;
}

function latest(...values: (string | null | undefined)[]): number | null {
  const present = values.map(instant).filter((v): v is number => v !== null);
  return present.length ? Math.max(...present) : null;
}

/**
 * Whether the photographer has ever participated in this conversation. Mirrors
 * the server-side rule in lib/inquiryReconcile.ts (`hasReplied`): a sent reply,
 * any outbound evidence, or booking progress all count.
 */
export function inquiryEverReplied(inquiry: ConversationInquiry): boolean {
  return (
    inquiry.status === "responded" ||
    !!inquiry.reply_sent_at ||
    !!inquiry.last_outbound_at ||
    !!inquiry.invoice_sent_at ||
    !!inquiry.contract_sent_at ||
    !!inquiry.deposit_paid_at ||
    !!inquiry.confirmation_sent_at ||
    !!inquiry.gallery_delivered_at ||
    inquiry.booking_confirmed === true ||
    inquiry.payment_status === "paid"
  );
}

/**
 * Whether the client sent the latest relevant message. The reconciled
 * `needs_reply` flag is authoritative (it already folds in the manual
 * dismissal); `unreadInboundAt` lets a client reply Gmail reported but
 * reconciliation hasn't processed yet count immediately, and rows that were
 * never reconciled fall back to last-message direction, then to the legacy
 * "no reply stamped yet" heuristic.
 */
function clientWroteLast(
  inquiry: ConversationInquiry,
  unreadInboundAt?: number | null,
): boolean {
  if (unreadInboundAt != null) {
    const answered = Math.max(
      instant(inquiry.last_outbound_at) ?? -Infinity,
      instant(inquiry.needs_reply_dismissed_at) ?? -Infinity,
    );
    if (unreadInboundAt > answered) return true;
  }
  if (typeof inquiry.needs_reply === "boolean") return inquiry.needs_reply;
  if (inquiry.last_message_direction) return inquiry.last_message_direction === "inbound";
  // Never reconciled: compare the timestamps we do have, the same way the
  // server does — the submission itself is the first inbound contact, and sent
  // milestones stand in for outbound messages (a paid deposit is the client's
  // action, not ours, so it never counts as our message).
  const inboundAt = latest(inquiry.last_inbound_at, inquiry.created_at);
  const outboundAt = latest(
    inquiry.last_outbound_at,
    inquiry.reply_sent_at,
    inquiry.invoice_sent_at,
    inquiry.contract_sent_at,
    inquiry.confirmation_sent_at,
    inquiry.gallery_delivered_at,
  );
  if (inboundAt !== null && outboundAt !== null) return inboundAt > outboundAt;
  return !inquiry.reply_sent_at;
}

/**
 * Single source of truth for an inquiry card's status badge and rail color.
 * Administrative dispositions win; otherwise the latest relevant message
 * decides, so unlimited back-and-forth keeps alternating.
 */
export function inquiryConversationStatus(
  inquiry: ConversationInquiry,
  options: { unreadInboundAt?: number | null } = {},
): InquiryConversationStatus {
  if (inquiry.status === "not_interested") return "not_interested";
  // "manual" is a non-actionable disposition like archived (see the exempt set).
  if (inquiry.status === "archived" || inquiry.status === "manual") return "archived";
  // Never claim a reply we have no evidence for — an unanswered client stays new.
  if (!inquiryEverReplied(inquiry)) return "new";
  return clientWroteLast(inquiry, options.unreadInboundAt) ? "needs_reply" : "responded";
}

/**
 * Whether an inquiry is awaiting a response from the photographer — i.e. it
 * belongs in the "Needs reply" queue (counts, filter chip, sort priority).
 * Brand-new inquiries count too; the card still shows them green as NEW.
 */
export function inquiryNeedsReply(inquiry: ConversationInquiry): boolean {
  if (NEEDS_REPLY_EXEMPT_STATUSES.has(inquiry.status)) return false;
  const status = inquiryConversationStatus(inquiry);
  return status === "new" || status === "needs_reply";
}

export type AdminInquiryCreate = {
  name: string;
  email: string;
  message: string;
  phone?: string | null;
  session_type?: string | null;
  date_in_mind?: string | null;
  status?: string;
  payment_status?: string | null;
  booking_confirmed?: boolean | null;
  session_date?: string | null;
  instagram?: string | null;
  school?: string | null;
  preferred_time?: string | null;
  people?: string | null;
  location?: string | null;
};

export type AdminInquiryPatch = Partial<Pick<
  AdminInquiry,
  | "status"
  | "session_type"
  | "session_date"
  | "preferred_time"
  | "reply_sent_at"
  | "invoice_sent_at"
  | "contract_sent_at"
  | "deposit_paid_at"
  | "gallery_delivered_at"
  | "confirmation_sent_at"
  | "needs_reply"
  | "needs_reply_dismissed_at"
  | "last_inbound_at"
  | "last_outbound_at"
  | "last_message_at"
  | "last_message_direction"
  | "status_source"
>>;

type InquiryResponse = {
  inquiry?: AdminInquiry;
  inquiries?: AdminInquiry[];
  error?: string;
};

async function parseResponse(res: Response): Promise<InquiryResponse> {
  const json = await res.json() as InquiryResponse;
  if (!res.ok) throw new Error(json.error ?? "Inquiry request failed.");
  return json;
}

export async function loadAdminInquiries(): Promise<AdminInquiry[]> {
  const json = await parseResponse(await fetch("/api/admin/inquiries"));
  return json.inquiries ?? [];
}

export type InquiryRefreshResult = {
  connected: boolean;
  updated: number;
  skipped?: string;
};

/**
 * Asks the server to fold any new Gmail activity into inquiry reply state.
 * Cheap and deterministic (see app/api/admin/inquiries/refresh/route.ts), so
 * the dashboard can call it on open. Never throws — a failed refresh leaves
 * the cards on their last verified state rather than breaking the page.
 */
export async function refreshAdminInquiries(): Promise<InquiryRefreshResult> {
  try {
    const res = await fetch("/api/admin/inquiries/refresh", { method: "POST" });
    if (!res.ok) return { connected: false, updated: 0, skipped: `http-${res.status}` };
    const json = await res.json() as Partial<InquiryRefreshResult>;
    return { connected: json.connected ?? false, updated: json.updated ?? 0, skipped: json.skipped };
  } catch {
    return { connected: false, updated: 0, skipped: "network" };
  }
}

export async function loadAdminInquiry(id: number): Promise<AdminInquiry | null> {
  const res = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  const json = await parseResponse(res);
  return json.inquiry ?? null;
}

export async function createAdminInquiry(input: AdminInquiryCreate): Promise<AdminInquiry> {
  const json = await parseResponse(await fetch("/api/admin/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
  if (!json.inquiry) throw new Error("Inquiry was not returned.");
  return json.inquiry;
}

export async function updateAdminInquiry(id: number, updates: AdminInquiryPatch): Promise<AdminInquiry> {
  const json = await parseResponse(await fetch("/api/admin/inquiries", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, updates }),
  }));
  if (!json.inquiry) throw new Error("Inquiry was not returned.");
  return json.inquiry;
}

export async function deleteAdminInquiry(id: number): Promise<void> {
  await parseResponse(await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }));
}
