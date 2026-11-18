// ─────────────────────────────────────────────────────────────────────────────
// Pixieset document notifications → typed timeline events.
//
// Pixieset emails the photographer a copy of every invoice and contract it
// sends, plus a notice when a contract is completed. Those land in the
// photographer's own inbox, addressed to the photographer — so nothing in the
// headers names the client. This module only classifies the message and lifts
// out the identity hints the provider put there (a contract name, an invoice
// number, a greeting first name). Who that is gets decided separately in
// lib/providerEventAttribution.ts.
//
// Message text is untrusted input: it is matched against fixed patterns and
// never interpreted, logged, or stored.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getHeader,
  hasExcludedLabel,
  msgDate,
  parseSenderAddress,
  type GmailMessage,
} from "@/lib/gmailSyncHelpers";

/** Sends the client-facing documents (and the photographer's copy of each). */
const PIXIESET_SHARE_SENDER = "mailer@share.pixiesetmail.com";
/** Sends account notifications to the photographer. */
const PIXIESET_NOTICE_SENDER = "no-reply@notifications.pixiesetmail.com";
/** The address the same notices came from until late 2026. */
const PIXIESET_LEGACY_NOTICE_SENDER = "notifications@pixiesetmail.com";

/**
 * Gmail `from:` clause for payment notices. A subject search alone would also
 * read any stranger's "Payment on the way" mail as income.
 */
export const PIXIESET_NOTICE_FROM_QUERY = `from:(${PIXIESET_NOTICE_SENDER} OR ${PIXIESET_LEGACY_NOTICE_SENDER})`;

/** Gmail search for the document mail above. Archived mail is included by default. */
export const PROVIDER_DISCOVERY_QUERY =
  `from:(${PIXIESET_SHARE_SENDER} OR ${PIXIESET_NOTICE_SENDER}) ` +
  `subject:(invoice OR contract) newer_than:365d -in:trash -in:spam -in:draft`;

type EventBase = { at: string; messageId: string };

export type ProviderEvent =
  | (EventBase & { kind: "invoice_sent"; invoiceNumber: string | null; firstName: string | null })
  | (EventBase & { kind: "contract_sent"; fullName: string | null })
  | (EventBase & { kind: "contract_signed"; fullName: string | null })
  // The client CHOSE a payment method. Money has not been verified as received,
  // so this is only ever an identity hint (it ties an invoice number to a name).
  | (EventBase & { kind: "payment_pending"; fullName: string | null; invoiceNumber: string | null });

const INVOICE_SUBJECT = /^invoice\s+#?(\d+)\s+from\s+\S/i;
const CONTRACT_SUBJECT = /^contract\s+from\s+\S/i;
const COMPLETE_SUBJECT = /^(.+)['’]s contract is complete$/i;
const PAYMENT_PENDING_SUBJECT = /^payment on the way for (.+)['’]s invoice #?(\d+)$/i;
const GREETING = /\bHi\s+([^,!.]{1,40}),/;
const CONTRACT_NAME = /review and sign\s+(.{1,80}?)\s+Hi,/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const clean = (value: string | undefined) => value?.replace(/\s+/g, " ").trim() || null;

function classifyShareMail(subject: string, snippet: string, base: EventBase): ProviderEvent | null {
  const invoice = subject.match(INVOICE_SUBJECT);
  if (invoice) {
    return { ...base, kind: "invoice_sent", invoiceNumber: invoice[1], firstName: clean(snippet.match(GREETING)?.[1]) };
  }
  if (CONTRACT_SUBJECT.test(subject)) {
    // Pixieset names the document "<Client Name> Contract".
    const named = clean(snippet.match(CONTRACT_NAME)?.[1]);
    return { ...base, kind: "contract_sent", fullName: clean(named?.replace(/\s+contract$/i, "")) };
  }
  return null;
}

function classifyNoticeMail(subject: string, base: EventBase): ProviderEvent | null {
  const complete = subject.match(COMPLETE_SUBJECT);
  if (complete) return { ...base, kind: "contract_signed", fullName: clean(complete[1]) };
  const pending = subject.match(PAYMENT_PENDING_SUBJECT);
  if (pending) {
    return { ...base, kind: "payment_pending", fullName: clean(pending[1]), invoiceNumber: pending[2] };
  }
  return null;
}

/**
 * Classifies one Gmail message. Returns null for anything that is not a
 * document notice from the exact Pixieset sending addresses — look-alike
 * domains, an address in the display name, drafts, trash, and undated mail.
 */
export function classifyProviderMessage(message: GmailMessage): ProviderEvent | null {
  if (hasExcludedLabel(message)) return null;
  const at = msgDate(message.internalDate);
  if (!at) return null;

  const headers = message.payload?.headers ?? [];
  const sender = parseSenderAddress(getHeader(headers, "From"));
  const subject = getHeader(headers, "Subject").trim();
  const base = { at, messageId: message.id };

  if (sender === PIXIESET_SHARE_SENDER) {
    return classifyShareMail(subject, decodeEntities(message.snippet ?? ""), base);
  }
  if (sender === PIXIESET_NOTICE_SENDER) return classifyNoticeMail(subject, base);
  return null;
}
