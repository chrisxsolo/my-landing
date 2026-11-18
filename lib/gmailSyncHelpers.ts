// ─────────────────────────────────────────────────────────────────────────────
// Shared Gmail helpers for the timeline sync route: metadata-level message
// fetching plus subject-line heuristics for invoice / contract / payment /
// signing events.
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const LIST_PAGE_SIZE = 100;
// Metadata reads run in bounded batches — a burst of hundreds trips Gmail's
// per-user rate limit and the 429s used to vanish as "no such message".
const META_FETCH_CONCURRENCY = 25;
// Labels that mean a message was never actually exchanged: unsent drafts are
// ordinary messages in the Gmail API, and trashed/spam mail is not evidence.
const EXCLUDED_GMAIL_LABELS = ["DRAFT", "TRASH", "SPAM"];

// E-sign providers whose completion notices count as "contract signed".
const ESIGN_DOMAINS = {
  docusign: ["docusign.net", "docusign.com"],
  pandadoc: ["pandadoc.com", "pandadoc.net"],
  honeybook: ["honeybook.com"],
  hellosign: ["hellosign.com"],
  pixieset: ["pixiesetmail.com"],
};

export type GmailHeader = { name: string; value: string };
export type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
};

export type GmailFetchResult = {
  messages: GmailMessage[];
  /** The search itself failed (expired token, rate limit) — not "no results". */
  listFailed: boolean;
  /** Messages the search found but that could not be read. */
  failedReads: number;
  /** More matching messages exist beyond the cap. */
  truncated: boolean;
};

export function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return headerValue.toLowerCase().trim();
}

/**
 * The actual sending address of a From header. Reads the trailing <addr> so an
 * address planted in the display name can never pass as the sender.
 */
export function parseSenderAddress(headerValue: string): string | null {
  const angled = headerValue.match(/<([^<>]+)>\s*$/);
  const candidate = (angled ? angled[1] : headerValue).trim().toLowerCase();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(candidate) ? candidate : null;
}

/** True when the sender's host is the domain itself or a subdomain of it. */
function senderIsFromDomain(from: string, domains: string[]): boolean {
  const host = parseSenderAddress(from)?.split("@")[1];
  if (!host) return false;
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

export function hasExcludedLabel(message: { labelIds?: string[] }): boolean {
  return !!message.labelIds?.some(label => EXCLUDED_GMAIL_LABELS.includes(label));
}

export function isInvoiceSubject(subject: string): boolean {
  return /invoice/i.test(subject) && /soloxsnaps/i.test(subject);
}

export function isContractSubject(subject: string): boolean {
  return /contract/i.test(subject) && /soloxsnaps/i.test(subject);
}

export function isPaymentReceivedSubject(subject: string, from: string): boolean {
  const sub = subject.toLowerCase();
  const frm = from.toLowerCase();
  if (frm.includes("venmo.com") && (sub.includes("paid you") || sub.includes("sent you"))) return true;
  if (frm.includes("paypal.com") && (sub.includes("payment received") || sub.includes("you received"))) return true;
  if (frm.includes("cash.app") && sub.includes("received")) return true;
  if (frm.includes("square.com") && sub.includes("payment")) return true;
  if (frm.includes("stripe.com") && sub.includes("payment")) return true;
  if (frm.includes("honeybook.com") && (sub.includes("paid") || sub.includes("payment"))) return true;
  if (sub.includes("deposit received") || sub.includes("deposit paid")) return true;
  return false;
}

/**
 * A completion notice from a known e-sign provider. The sender's real domain
 * must match — a client merely discussing the contract is not a signature
 * (that conversational evidence is the AI thread scan's job).
 */
export function isContractSignedSubject(subject: string, from: string): boolean {
  const sub = subject.toLowerCase();
  const fromProvider = (domains: string[]) => senderIsFromDomain(from, domains);
  if (fromProvider(ESIGN_DOMAINS.docusign) && sub.includes("completed")) return true;
  if (fromProvider(ESIGN_DOMAINS.pandadoc) && (sub.includes("signed") || sub.includes("completed"))) return true;
  if (fromProvider(ESIGN_DOMAINS.honeybook) && (sub.includes("signed") || sub.includes("contract"))) return true;
  if (fromProvider(ESIGN_DOMAINS.hellosign) && sub.includes("completed")) return true;
  if (fromProvider(ESIGN_DOMAINS.pixieset) && /contract is complete/.test(sub)) return true;
  return false;
}

/** ISO timestamp of a Gmail message, or null — never "now" for a missing date. */
export function msgDate(internalDate?: string): string | null {
  if (!internalDate) return null;
  const ms = parseInt(internalDate, 10);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function extractClientEmailFromSubject(subject: string, clientEmails: Set<string>): string | null {
  const lower = subject.toLowerCase();
  for (const email of clientEmails) {
    if (lower.includes(email.toLowerCase())) return email;
  }
  return null;
}

/** Lowercased, accent-free, punctuation-free name with single spaces. */
export function normalizePersonName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The one client whose whole name (first + last at least) appears in the
 * subject as a phrase. A shared first name or a partial token is not a match,
 * and neither is a full name two clients share.
 */
export function matchClientNameInSubject(subject: string, clientNames: Map<string, string>): string | null {
  const haystack = ` ${normalizePersonName(subject)} `;
  const matches = new Set<string>();
  for (const [email, name] of clientNames) {
    const normalized = normalizePersonName(name);
    if (normalized.split(" ").length < 2) continue;
    if (haystack.includes(` ${normalized} `)) matches.add(email);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

async function listMessageIds(auth: string, query: string, maxResults: number) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const pageSize = Math.min(LIST_PAGE_SIZE, maxResults - ids.length);
    const url = `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${pageSize}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) return { ids, listFailed: true, truncated: false };
    const data = await res.json() as { messages?: { id: string }[]; nextPageToken?: string };
    ids.push(...(data.messages ?? []).map(m => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < maxResults);
  return { ids: ids.slice(0, maxResults), listFailed: false, truncated: !!pageToken };
}

async function readMessageMeta(auth: string, id: string): Promise<GmailMessage | null> {
  try {
    const res = await fetch(
      `${GMAIL_API}/messages/${id}` +
      `?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: auth } },
    );
    if (!res.ok) return null;
    return await res.json() as GmailMessage;
  } catch { return null; }
}

/**
 * Searches Gmail (paginated up to `maxResults`) and reads each hit's metadata.
 * Failures are reported, never folded into an empty result: a caller must be
 * able to tell "nothing matched" from "could not look".
 */
export async function fetchMessages(auth: string, query: string, maxResults = 50): Promise<GmailFetchResult> {
  let listed: Awaited<ReturnType<typeof listMessageIds>>;
  try {
    listed = await listMessageIds(auth, query, maxResults);
  } catch {
    listed = { ids: [], listFailed: true, truncated: false };
  }

  const messages: GmailMessage[] = [];
  let failedReads = 0;
  for (let i = 0; i < listed.ids.length; i += META_FETCH_CONCURRENCY) {
    const batch = await Promise.all(
      listed.ids.slice(i, i + META_FETCH_CONCURRENCY).map(id => readMessageMeta(auth, id)),
    );
    for (const message of batch) {
      if (!message) failedReads++;
      else if (!hasExcludedLabel(message)) messages.push(message);
    }
  }
  return { messages, listFailed: listed.listFailed, failedReads, truncated: listed.truncated };
}
