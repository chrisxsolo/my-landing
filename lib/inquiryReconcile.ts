// ─────────────────────────────────────────────────────────────────────────────
// lib/inquiryReconcile.ts
//
// Pure reply-status reconciliation for inquiries. Given the full set of Gmail
// messages matched to an inquiry (both directions) plus the inquiry's stamped
// milestone timestamps, derives status / needs_reply / last-message state.
//
// Rules:
//  - "new" means the photographer has NEVER replied. Any outbound email after
//    the inquiry arrived — or any booking-progress evidence (invoice, contract,
//    deposit, confirmation, gallery, paid) — promotes to "responded".
//  - "responded" never regresses to "new", even when the latest message came
//    from the client. That case is responded + needs_reply=true.
//  - needs_reply is true only when the latest inbound client message is newer
//    than the latest outbound evidence.
//  - archived / not_interested / manual statuses, and any status the user set
//    by hand (status_source = "manual"), are never changed by automatic sync.
//
// No I/O here — the Gmail fetch layer lives in lib/inquiryReconcileGmail.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const INQUIRY_STATUS = {
  NEW: "new",
  RESPONDED: "responded",
  ARCHIVED: "archived",
  NOT_INTERESTED: "not_interested",
  MANUAL: "manual",
} as const;

export const STATUS_SOURCE = { AUTOMATIC: "automatic", MANUAL: "manual" } as const;

// Statuses automatic reconciliation must never overwrite.
const PROTECTED_STATUSES = new Set<string>([
  INQUIRY_STATUS.ARCHIVED,
  INQUIRY_STATUS.NOT_INTERESTED,
  INQUIRY_STATUS.MANUAL,
]);

// Outbound sent up to this long before the inquiry row was created still
// counts as a reply (clock skew between Gmail and the DB insert).
const CREATION_SKEW_MS = 60_000;

export type MessageDirection = "inbound" | "outbound";

export type ReconcileMessage = {
  id: string;
  threadId: string | null;
  /** ISO timestamp of the message. */
  at: string;
  /** Normalized sender address. */
  fromEmail: string;
  direction: MessageDirection;
};

export type ReconcileInquirySnapshot = {
  id: number;
  email: string;
  status: string;
  statusSource: string | null;
  createdAt: string;
  replySentAt: string | null;
  invoiceSentAt: string | null;
  contractSentAt: string | null;
  depositPaidAt: string | null;
  confirmationSentAt: string | null;
  galleryDeliveredAt: string | null;
  bookingConfirmed: boolean | null;
  paymentStatus: string | null;
  needsReply: boolean | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  gmailThreadIds: string[] | null;
};

export type InquiryReconciliation = {
  changed: boolean;
  nextStatus: string;
  hasReplied: boolean;
  needsReply: boolean;
  /** Column → value for only the fields whose value actually changed. */
  updates: Record<string, unknown>;
  debug: {
    inquiryId: number;
    email: string;
    matchedMessages: number;
    matchedThreads: string[];
    lastInboundAt: string | null;
    lastOutboundAt: string | null;
    hasReplied: boolean;
    needsReply: boolean;
    previousStatus: string;
    nextStatus: string;
    bookingProgressEvents: string[];
  };
};

/** Extract the bare address from values like `Esther Chan <a@b.com>`, lowercased. */
export function normalizeEmail(raw: string): string {
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/** True when the message sender is one of the connected Gmail account's addresses. */
export function isOutboundMessage(
  message: Pick<ReconcileMessage, "fromEmail">,
  connectedAccountEmails: string[],
): boolean {
  const from = normalizeEmail(message.fromEmail);
  return connectedAccountEmails.some(email => normalizeEmail(email) === from);
}

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  let ms = Date.parse(value);
  // Postgres timestamptz text ("2026-07-07 18:04:08.13+00") isn't strict ISO;
  // normalize the separator and short offset before giving up.
  if (Number.isNaN(ms)) ms = Date.parse(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(ms) ? null : ms;
}

function maxMs(...values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? Math.max(...present) : null;
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

function sameInstant(a: string | null, b: string | null): boolean {
  return toMs(a) === toMs(b);
}

function bookingProgressEvents(inquiry: ReconcileInquirySnapshot): string[] {
  const events: string[] = [];
  if (inquiry.invoiceSentAt) events.push("invoice_sent");
  if (inquiry.contractSentAt) events.push("contract_sent");
  if (inquiry.depositPaidAt) events.push("deposit_paid");
  if (inquiry.confirmationSentAt) events.push("session_confirmed");
  if (inquiry.galleryDeliveredAt) events.push("gallery_delivered");
  if (inquiry.bookingConfirmed === true) events.push("booking_confirmed");
  if (inquiry.paymentStatus === "paid") events.push("payment_received");
  return events;
}

export function computeInquiryReconciliation(
  inquiry: ReconcileInquirySnapshot,
  messages: ReconcileMessage[],
): InquiryReconciliation {
  const createdMs = toMs(inquiry.createdAt) ?? 0;
  const sorted = [...messages].sort((a, b) => (toMs(a.at) ?? 0) - (toMs(b.at) ?? 0));

  const inbound = sorted.filter(m => m.direction === "inbound");
  const outbound = sorted.filter(m => m.direction === "outbound");
  const outboundAfterCreation = outbound.filter(m => (toMs(m.at) ?? 0) >= createdMs - CREATION_SKEW_MS);

  // The inquiry submission itself is the first inbound contact.
  const lastInboundMs = maxMs(createdMs, ...inbound.map(m => toMs(m.at)));
  // Stamped outbound milestones back up the Gmail scan — a missed sent message
  // must not make a replied-to inquiry look untouched.
  const lastOutboundMs = maxMs(
    ...outbound.map(m => toMs(m.at)),
    toMs(inquiry.replySentAt),
    toMs(inquiry.invoiceSentAt),
    toMs(inquiry.contractSentAt),
    toMs(inquiry.confirmationSentAt),
    toMs(inquiry.galleryDeliveredAt),
  );

  const progress = bookingProgressEvents(inquiry);
  const hasReplied = outboundAfterCreation.length > 0 || !!inquiry.replySentAt || progress.length > 0;

  const statusProtected =
    PROTECTED_STATUSES.has(inquiry.status) || inquiry.statusSource === STATUS_SOURCE.MANUAL;
  let nextStatus = inquiry.status;
  if (!statusProtected && hasReplied) nextStatus = INQUIRY_STATUS.RESPONDED;
  // Rule: never regress an inquiry back to "new" — reconciliation only ever
  // promotes, so any other branch keeps the current status.

  const closed =
    nextStatus === INQUIRY_STATUS.ARCHIVED || nextStatus === INQUIRY_STATUS.NOT_INTERESTED;
  const needsReply = !closed && lastInboundMs !== null && lastInboundMs > (lastOutboundMs ?? -Infinity);

  const lastMessageMs = maxMs(lastInboundMs, lastOutboundMs);
  const lastMessageDirection =
    lastMessageMs === null ? null : lastMessageMs === lastOutboundMs ? "outbound" : "inbound";

  const threadIds = [...new Set([
    ...(inquiry.gmailThreadIds ?? []),
    ...sorted.map(m => m.threadId).filter((t): t is string => !!t),
  ])].sort();

  const firstReplyMs = outboundAfterCreation.length ? toMs(outboundAfterCreation[0].at) : null;

  const updates: Record<string, unknown> = {};
  if (nextStatus !== inquiry.status) updates.status = nextStatus;
  if (needsReply !== inquiry.needsReply) updates.needs_reply = needsReply;
  if (!sameInstant(iso(lastInboundMs), inquiry.lastInboundAt)) updates.last_inbound_at = iso(lastInboundMs);
  if (!sameInstant(iso(lastOutboundMs), inquiry.lastOutboundAt)) updates.last_outbound_at = iso(lastOutboundMs);
  if (!sameInstant(iso(lastMessageMs), inquiry.lastMessageAt)) updates.last_message_at = iso(lastMessageMs);
  if (lastMessageDirection !== (inquiry.lastMessageDirection ?? null)) {
    updates.last_message_direction = lastMessageDirection;
  }
  if (!inquiry.replySentAt && firstReplyMs !== null) updates.reply_sent_at = iso(firstReplyMs);
  if (threadIds.join("\n") !== [...(inquiry.gmailThreadIds ?? [])].sort().join("\n")) {
    updates.gmail_thread_ids = threadIds;
  }

  return {
    changed: Object.keys(updates).length > 0,
    nextStatus,
    hasReplied,
    needsReply,
    updates,
    debug: {
      inquiryId: inquiry.id,
      email: normalizeEmail(inquiry.email),
      matchedMessages: sorted.length,
      matchedThreads: threadIds,
      lastInboundAt: iso(lastInboundMs),
      lastOutboundAt: iso(lastOutboundMs),
      hasReplied,
      needsReply,
      previousStatus: inquiry.status,
      nextStatus,
      bookingProgressEvents: progress,
    },
  };
}
