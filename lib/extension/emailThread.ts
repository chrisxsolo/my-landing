// The client's Gmail thread as one labelled transcript for the extension's
// fact extraction. Every message carries who wrote it (the client, the
// photographer's connected account, or a third party such as a payment or
// e-sign notice), its send date and its thread, and quoted history is cut
// away so an old paragraph echoed in a reply is never read as a new request.
// Bodies are bounded and never logged.

import { createHash } from "node:crypto";
import type { EmailCoverage } from "../invoiceDraft/types";
import { stripQuotedReply } from "../contentEngine/emailFacts/conversation";
import { extractEmailText, type GmailMimePart } from "../gmailBodyText";
import { getValidTokens } from "../gmailTokens";
import { normalizeEmail } from "../inquiryReconcile";
import { getConnectedAccountEmails } from "../inquiryReconcileGmail";
import { BUSINESS_TIME_ZONE, businessDate } from "./sessionDates";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_SEARCH_RESULTS = 40;
const MAX_THREAD_MESSAGES = 25;
/** Older priced messages from the photographer kept beyond that limit. */
const MAX_PINNED_MESSAGES = 5;
/** Threads read whole for one booking. */
const MAX_THREADS = 6;
const BODY_CHAR_LIMIT = 3000;
/** How much raw text is read before quoted history is stripped. */
const RAW_READ_FACTOR = 4;
const TRUNCATION_MARK = "\n[message cut here: the rest was not read]";
/** Never conversation state: unsent drafts, binned and junked mail. */
const EXCLUDED_LABELS = ["DRAFT", "TRASH", "SPAM"];
const DAY_MS = 24 * 60 * 60 * 1000;
/** A client often emails shortly before filling the form; older mail is another booking. */
const BOOKING_LEAD_DAYS = 14;
/** How far before the window a thread found inside it is still read. */
const THREAD_LOOKBACK_DAYS = 45;
/** A second form this long after the first is a new booking, not a resubmission. */
const NEXT_BOOKING_GAP_DAYS = 30;

export type MessageParty = "client" | "photographer" | "other";

/** One message as the transcript renders it. */
export interface TranscriptMessage {
  index: number;
  threadId: string;
  /** ISO timestamp. */
  at: string;
  direction: MessageParty;
  body: string;
}

/**
 * The stretch of mail that belongs to one booking. A returning client has
 * older threads under the same address; those are never read into this one.
 */
export interface BookingWindow {
  /** ISO instant; mail before it belongs to an earlier booking. */
  after: string | null;
  /** ISO instant; mail from it on belongs to a later booking. */
  before: string | null;
}

export const OPEN_WINDOW: BookingWindow = { after: null, before: null };

/**
 * The window for an inquiry submitted at `createdAt`, given the same
 * client's next inquiry (if any). A quick resubmission of the form is the
 * same booking and does not close the window.
 */
export function bookingWindow(createdAt: string | null | undefined, nextCreatedAt: string | null | undefined = null): BookingWindow {
  const start = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(start)) return OPEN_WINDOW;
  const next = nextCreatedAt ? Date.parse(nextCreatedAt) : NaN;
  const closes = Number.isFinite(next) && next - start >= NEXT_BOOKING_GAP_DAYS * DAY_MS;
  // Threads found inside the window are then read whole (loadWholeThreads),
  // so a long-running conversation is never cut at either edge.
  return {
    after: new Date(start - BOOKING_LEAD_DAYS * DAY_MS).toISOString(),
    before: closes ? new Date(next - BOOKING_LEAD_DAYS * DAY_MS).toISOString() : null,
  };
}

interface ReadContext {
  context: string;
  messageCount: number;
  /** Business-local send date of each transcript message, in order ("YYYY-MM-DD"). */
  messageDates: string[];
  /** Who wrote each transcript message and what it said, in order. Used in-process only; never stored or returned. */
  messages: { direction: MessageParty; body: string }[];
  coverage: EmailCoverage;
  /** Fingerprint of the messages read; changes when one arrives or is removed. */
  revision: string;
}

export type EmailContext =
  | ({ status: "read" | "partial" } & ReadContext)
  | { status: "none" | "unavailable"; context: ""; messageCount: 0 };

const UNAVAILABLE: EmailContext = { status: "unavailable", context: "", messageCount: 0 };
const NONE: EmailContext = { status: "none", context: "", messageCount: 0 };

type GmailFullMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMimePart & { headers?: { name: string; value: string }[] };
};

export interface LabelledMessage {
  id: string;
  threadId: string;
  at: string;
  direction: MessageParty;
  body: string;
  /** True when the body was longer than the limit and was cut. */
  truncated: boolean;
}

const PARTY_LABELS: Record<MessageParty, string> = {
  client: "CLIENT → PHOTOGRAPHER",
  photographer: "PHOTOGRAPHER → CLIENT",
  other: "THIRD PARTY (automated notice, not the client)",
};

function sentOn(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "unknown date";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: BUSINESS_TIME_ZONE });
}

/** The transcript the model reads: oldest first, each message labelled by number, sender, date and thread. */
export function renderTranscript(messages: TranscriptMessage[]): string {
  const threadNumbers = new Map<string, number>();
  for (const message of messages) {
    if (!threadNumbers.has(message.threadId)) threadNumbers.set(message.threadId, threadNumbers.size + 1);
  }
  return messages.map((message) => {
    const header = `--- Message ${message.index} of ${messages.length} | ${PARTY_LABELS[message.direction]} | ${sentOn(message.at)} | thread ${threadNumbers.get(message.threadId)} ---`;
    return `${header}\n${message.body}`;
  }).join("\n\n");
}

function header(message: GmailFullMessage, name: string): string {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Who wrote a message. With no connected address known (the Gmail profile
 * lookup failed), anyone who is not the client is taken for the photographer
 * rather than dropping the photographer's own quotes from the thread.
 */
function partyOf(from: string, clientEmail: string, connectedEmails: string[]): MessageParty {
  if (connectedEmails.includes(from)) return "photographer";
  if (from === clientEmail) return "client";
  return connectedEmails.length ? "other" : "photographer";
}

/** One Gmail message as a labelled transcript message, or null when it is not part of the conversation. */
export function toLabelledMessage(message: GmailFullMessage, clientEmail: string, connectedEmails: string[]): LabelledMessage | null {
  if (message.labelIds?.some((label) => EXCLUDED_LABELS.includes(label))) return null;
  if (!message.internalDate) return null;
  const from = normalizeEmail(header(message, "From"));
  if (!from.includes("@")) return null;
  // Quoted history is cut before the length limit applies, so a short reply
  // above a long quote is never reported as a cut message.
  const raw = extractEmailText(message.payload, BODY_CHAR_LIMIT * RAW_READ_FACTOR) || message.snippet || "";
  const stripped = stripQuotedReply(raw);
  if (!stripped.trim()) return null;
  const truncated = stripped.length > BODY_CHAR_LIMIT;
  const body = truncated ? `${stripped.slice(0, BODY_CHAR_LIMIT)}${TRUNCATION_MARK}` : stripped;
  return {
    id: message.id,
    threadId: message.threadId ?? message.id,
    at: new Date(Number(message.internalDate)).toISOString(),
    direction: partyOf(from, normalizeEmail(clientEmail), connectedEmails.map(normalizeEmail)),
    body,
    truncated,
  };
}

/**
 * The newest messages, one per id, oldest first and numbered from 1. When
 * the thread is longer than the limit, older messages in which the
 * photographer wrote a price are kept as well: a total negotiated early in a
 * long thread must not fall out of the transcript.
 */
export function orderMessages(messages: LabelledMessage[], limit = MAX_THREAD_MESSAGES): (LabelledMessage & TranscriptMessage)[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const ordered = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const cut = Math.max(0, ordered.length - limit);
  const pinned = ordered.slice(0, cut).filter((message) => message.direction === "photographer" && message.body.includes("$")).slice(-MAX_PINNED_MESSAGES);
  return [...pinned, ...ordered.slice(cut)].map((message, i) => ({ ...message, index: i + 1 }));
}

type Fetched<T> = { ok: true; value: T } | { ok: false };

async function gmailGet<T>(path: string, headers: Record<string, string>): Promise<Fetched<T>> {
  try {
    const res = await fetch(`${GMAIL_API}/${path}`, { headers });
    return res.ok ? { ok: true, value: await res.json() as T } : { ok: false };
  } catch {
    return { ok: false };
  }
}

const epochSeconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** The Gmail search for one client's mail inside a booking window. */
export function bookingQuery(email: string, window: BookingWindow): string {
  const bounds = [window.after ? `after:${epochSeconds(window.after)}` : "", window.before ? `before:${epochSeconds(window.before)}` : ""];
  return [`{from:${email} to:${email}}`, ...bounds].filter(Boolean).join(" ");
}

function revisionOf(messages: LabelledMessage[]): string {
  const hash = createHash("sha256");
  for (const message of messages) hash.update(`${message.id}:${message.at}:${message.body.length}\n`);
  return hash.digest("hex").slice(0, 16);
}

interface Loaded { messages: GmailFullMessage[]; failed: number }

/**
 * Every message of the threads the window found. A thread that began inside
 * the window keeps its later replies, and one that began just before it
 * keeps its opening, so the window picks the booking's threads without
 * cutting any of them in half.
 */
async function loadWholeThreads(found: GmailFullMessage[], window: BookingWindow, headers: Record<string, string>): Promise<Loaded> {
  const allIds = [...new Set(found.map((message) => message.threadId).filter((id): id is string => Boolean(id)))];
  const threadIds = allIds.slice(0, MAX_THREADS);
  const threads = await Promise.all(threadIds.map((id) => gmailGet<{ messages?: GmailFullMessage[] }>(`threads/${id}?format=full`, headers)));
  // A client who replies on last year's thread must not bring last year's
  // booking with them: a thread is followed back only a limited way.
  const earliest = window.after ? Date.parse(window.after) - THREAD_LOOKBACK_DAYS * DAY_MS : -Infinity;
  const messages = threads.flatMap((thread) => (thread.ok ? thread.value.messages ?? [] : [])).filter((message) => Number(message.internalDate) >= earliest);
  // Threads past the limit were not read whole; that is a gap, and is counted as one.
  return { messages, failed: threads.filter((thread) => !thread.ok).length + (allIds.length - threadIds.length) };
}

async function loadMessages(email: string, window: BookingWindow, headers: Record<string, string>): Promise<(Loaded & { beyondPage: number }) | null> {
  const query = encodeURIComponent(bookingQuery(email, window));
  const search = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>(`messages?q=${query}&maxResults=${MAX_SEARCH_RESULTS}`, headers);
  if (!search.ok) return null;
  const ids = (search.value.messages ?? []).map((m) => m.id);
  const fetched = await Promise.all(ids.map((id) => gmailGet<GmailFullMessage>(`messages/${id}?format=full`, headers)));
  const found = fetched.flatMap((message) => (message.ok ? [message.value] : []));
  const failed = fetched.length - found.length;
  // Gmail lists newest first, so anything past the page is older mail.
  const beyondPage = search.value.nextPageToken ? Math.max(1, (search.value.resultSizeEstimate ?? 0) - ids.length) : 0;
  // An open window already searched everything; only a bounded one can have cut a thread.
  const whole = window.after || window.before ? await loadWholeThreads(found, window, headers) : { messages: [], failed: 0 };
  return { messages: [...found, ...whole.messages], failed: failed + whole.failed, beyondPage };
}

/** The client's thread for one booking as a labelled transcript, or why there is none. */
export async function fetchEmailContext(email: string, window: BookingWindow = OPEN_WINDOW): Promise<EmailContext> {
  const tokens = await getValidTokens();
  if (!tokens) return UNAVAILABLE;
  const auth = `Bearer ${tokens.access_token}`;
  const headers = { Authorization: auth };
  const connectedEmails = await getConnectedAccountEmails(auth, tokens.email);
  const loaded = await loadMessages(email, window, headers);
  if (!loaded) {
    console.error("Extension session facts: Gmail search failed");
    return UNAVAILABLE;
  }
  const labelled = loaded.messages.flatMap((message) => toLabelledMessage(message, email, connectedEmails) ?? []);
  if (loaded.failed) console.error("Extension session facts: Gmail messages failed to load", { failed: loaded.failed });
  return contextFromMessages(labelled, { failed: loaded.failed, beyondPage: loaded.beyondPage });
}

/**
 * The transcript and its bookkeeping for a set of labelled messages. Split
 * from the Gmail fetch so the live evaluation (tests/live) can put a
 * synthetic thread through exactly what production does next.
 */
export function contextFromMessages(labelled: LabelledMessage[], loss: { failed: number; beyondPage: number } = { failed: 0, beyondPage: 0 }): EmailContext {
  const ordered = orderMessages(labelled);
  // Nothing readable is "no thread" only when nothing failed to load.
  if (!ordered.length) return loss.failed ? UNAVAILABLE : NONE;
  const coverage: EmailCoverage = {
    messages: ordered.length,
    failed: loss.failed,
    omitted: loss.beyondPage + Math.max(0, new Set(labelled.map((m) => m.id)).size - ordered.length),
    truncated: ordered.filter((message) => message.truncated).length,
  };
  return {
    status: loss.failed ? "partial" : "read",
    context: renderTranscript(ordered),
    messageCount: ordered.length,
    messageDates: ordered.map((message) => businessDate(new Date(message.at))),
    messages: ordered.map((message) => ({ direction: message.direction, body: message.body })),
    coverage,
    revision: revisionOf(ordered),
  };
}
