// ─────────────────────────────────────────────────────────────────────────────
// Gmail discovery stages for the timeline sync. Each stage adds dated
// observations to the evidence book and returns how the search itself went, so
// the route can tell an empty mailbox from a search that failed.
// ─────────────────────────────────────────────────────────────────────────────

import { scanMilestonesForClients, type MilestoneScanClient } from "@/lib/emailTimelineScan";
import {
  extractClientEmailFromSubject,
  extractEmail,
  fetchMessages,
  getHeader,
  isContractSignedSubject,
  isContractSubject,
  isInvoiceSubject,
  isPaymentReceivedSubject,
  matchClientNameInSubject,
  msgDate,
  type GmailFetchResult,
  type GmailMessage,
} from "@/lib/gmailSyncHelpers";
import { classifyProviderMessage, PROVIDER_DISCOVERY_QUERY, type ProviderEvent } from "@/lib/providerDocumentEvents";
import { attributeProviderEvents, type KnownClient } from "@/lib/providerEventAttribution";
import { addEvidence, type EvidenceBook, type MilestoneKind } from "@/lib/timelineSync/evidence";
import type { AgreedSession } from "@/lib/timelineSync/plan";
import type { DiscoveryStage, StageOutcome } from "@/lib/timelineSync/report";

const SENT_DOCUMENTS_QUERY = "in:sent (subject:Invoice OR subject:Contract) SoloxSnaps";
const SENT_REPLIES_QUERY = "in:sent newer_than:365d";
const PAYMENTS_QUERY =
  `in:inbox (from:venmo.com OR from:paypal.com OR from:cash.app OR from:square.com OR from:stripe.com ` +
  `OR from:honeybook.com OR subject:"deposit received" OR subject:"deposit paid" OR subject:"payment received") newer_than:365d`;
const SIGNED_NOTICES_QUERY =
  `in:inbox (from:docusign OR from:pandadoc OR from:honeybook.com OR from:hellosign) newer_than:365d`;
const PROVIDER_MESSAGE_CAP = 300;

const PROVIDER_KIND_TO_MILESTONE: Record<"invoice_sent" | "contract_sent" | "contract_signed", MilestoneKind> = {
  invoice_sent: "invoiceSent",
  contract_sent: "contractSent",
  contract_signed: "contractSigned",
};

/** Who heuristics may match a notice against. */
export type ClientDirectory = {
  /** Every known client address (portal sessions + inquiries). */
  emails: Set<string>;
  /** Address → name, for clients who already have a portal session. */
  sessionClientNames: Map<string, string>;
  /** Address → name, for every known client. */
  allClientNames: Map<string, string>;
};

// The sent / payment / e-sign searches deliberately read only the most recent
// matches, so hitting their cap is normal and not reported. The provider search
// is meant to cover the whole year: if it overflows, that is worth saying.
const outcome = (stage: DiscoveryStage, result: GmailFetchResult): StageOutcome => ({
  stage,
  listFailed: result.listFailed,
  failedReads: result.failedReads,
  truncated: stage === "provider_documents" && result.truncated,
});

const headersOf = (message: GmailMessage) => message.payload?.headers ?? [];

/** Invoices and contracts the photographer emailed straight from Gmail. */
export async function collectSentDocuments(auth: string, book: EvidenceBook): Promise<StageOutcome> {
  const result = await fetchMessages(auth, SENT_DOCUMENTS_QUERY, 100);
  for (const message of result.messages) {
    const subject = getHeader(headersOf(message), "Subject");
    const recipient = extractEmail(getHeader(headersOf(message), "To"));
    const at = msgDate(message.internalDate);
    if (isInvoiceSubject(subject)) addEvidence(book, recipient, "invoiceSent", at);
    if (isContractSubject(subject)) addEvidence(book, recipient, "contractSent", at);
  }
  return outcome("sent_documents", result);
}

/** Any recent sent mail — the earliest one to a client is the first reply. */
export async function collectSentReplies(auth: string, book: EvidenceBook): Promise<StageOutcome> {
  const result = await fetchMessages(auth, SENT_REPLIES_QUERY, 200);
  for (const message of result.messages) {
    const recipient = extractEmail(getHeader(headersOf(message), "To"));
    addEvidence(book, recipient, "reply", msgDate(message.internalDate));
  }
  return outcome("sent_replies", result);
}

/**
 * Payment-processor receipts. Unchanged in reach: only clients who already
 * have a portal session are matched by name, and the name must match whole.
 */
export async function collectPayments(
  auth: string,
  book: EvidenceBook,
  directory: ClientDirectory,
): Promise<StageOutcome> {
  const result = await fetchMessages(auth, PAYMENTS_QUERY, 50);
  const sessionEmails = new Set(directory.sessionClientNames.keys());
  for (const message of result.messages) {
    const subject = getHeader(headersOf(message), "Subject");
    if (!isPaymentReceivedSubject(subject, getHeader(headersOf(message), "From"))) continue;
    const email = extractClientEmailFromSubject(subject, sessionEmails)
      ?? matchClientNameInSubject(subject, directory.sessionClientNames);
    if (email) addEvidence(book, email, "depositPaid", msgDate(message.internalDate));
  }
  return outcome("payments", result);
}

/** Completion notices from third-party e-sign providers. */
export async function collectSignedNotices(
  auth: string,
  book: EvidenceBook,
  directory: ClientDirectory,
): Promise<StageOutcome> {
  const result = await fetchMessages(auth, SIGNED_NOTICES_QUERY, 50);
  for (const message of result.messages) {
    const subject = getHeader(headersOf(message), "Subject");
    if (!isContractSignedSubject(subject, getHeader(headersOf(message), "From"))) continue;
    const recipient = extractEmail(getHeader(headersOf(message), "To"));
    const email = (directory.emails.has(recipient) ? recipient : null)
      ?? extractClientEmailFromSubject(subject, directory.emails)
      ?? matchClientNameInSubject(subject, directory.allClientNames);
    if (email) addEvidence(book, email, "contractSigned", msgDate(message.internalDate));
  }
  return outcome("signed_notices", result);
}

type ProviderOutcome = StageOutcome & { ambiguous: number; unmatched: number };

/**
 * Pixieset's copies of sent invoices/contracts and its completion notices.
 * These sit in the photographer's own mailbox (inbox or archive), so they are
 * attributed by the provider's own naming — see providerEventAttribution.ts.
 */
export async function collectProviderDocuments(
  auth: string,
  book: EvidenceBook,
  clients: KnownClient[],
  ownerEmails: string[],
  reviewSince: string,
): Promise<ProviderOutcome> {
  const result = await fetchMessages(auth, PROVIDER_DISCOVERY_QUERY, PROVIDER_MESSAGE_CAP);
  const events = result.messages
    .map(classifyProviderMessage)
    .filter((event): event is ProviderEvent => event !== null);
  const attribution = attributeProviderEvents(events, clients, ownerEmails, { reviewSince });
  for (const event of attribution.attributed) {
    addEvidence(book, event.email, PROVIDER_KIND_TO_MILESTONE[event.kind], event.at);
  }
  return {
    ...outcome("provider_documents", result),
    ambiguous: attribution.ambiguous,
    unmatched: attribution.unmatched,
  };
}

type ThreadScanOutcome = {
  scanned: number;
  failed: number;
  notScanned: number;
  /** Shoot date/time both sides agreed on, per client address. */
  agreed: Map<string, AgreedSession>;
};

/**
 * AI pass over each target client's actual conversation — the fallback for
 * milestones no subject pattern shows (an ordinary reply saying "invoice and
 * contract are on their way"). Bounded by `deadlineAt`.
 */
export async function collectThreadMilestones(
  auth: string,
  book: EvidenceBook,
  targets: MilestoneScanClient[],
  deadlineAt: number,
): Promise<ThreadScanOutcome> {
  const scan = await scanMilestonesForClients(auth, targets, { deadlineAt });
  const agreed = new Map<string, AgreedSession>();
  for (const [email, m] of scan.results) {
    addEvidence(book, email, "reply", m.replySentAt);
    addEvidence(book, email, "invoiceSent", m.invoiceSentAt);
    addEvidence(book, email, "contractSent", m.contractSentAt);
    addEvidence(book, email, "depositPaid", m.depositPaidAt);
    addEvidence(book, email, "contractSigned", m.contractSignedAt);
    addEvidence(book, email, "galleryDelivered", m.galleryDeliveredAt);
    if (m.sessionDate || m.sessionTime) agreed.set(email, { sessionDate: m.sessionDate, sessionTime: m.sessionTime });
  }
  return { scanned: scan.results.size, failed: scan.failed.length, notScanned: scan.notScanned.length, agreed };
}
