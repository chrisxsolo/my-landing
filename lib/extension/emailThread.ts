// The client's Gmail thread as one labelled transcript for the extension's
// fact extraction. Every message carries who wrote it (the client, the
// photographer's connected account, or a third party such as a payment or
// e-sign notice), its send date and its thread, and quoted history is cut
// away so an old paragraph echoed in a reply is never read as a new request.
// Bodies are bounded and never logged.

import { stripQuotedReply } from "../contentEngine/emailFacts/conversation";
import { extractEmailText, type GmailMimePart } from "../gmailBodyText";
import { getValidTokens } from "../gmailTokens";
import { normalizeEmail } from "../inquiryReconcile";
import { getConnectedAccountEmails } from "../inquiryReconcileGmail";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_SEARCH_RESULTS = 20;
const MAX_THREAD_MESSAGES = 15;
const BODY_CHAR_LIMIT = 2000;
/** Never conversation state: unsent drafts, binned and junked mail. */
const EXCLUDED_LABELS = ["DRAFT", "TRASH", "SPAM"];
const BUSINESS_TIME_ZONE = "America/Los_Angeles";

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

export type EmailContext =
  | { status: "read"; context: string; messageCount: number }
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

interface LabelledMessage {
  id: string;
  threadId: string;
  at: string;
  direction: MessageParty;
  body: string;
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
  const raw = extractEmailText(message.payload, BODY_CHAR_LIMIT) || message.snippet || "";
  const body = stripQuotedReply(raw).slice(0, BODY_CHAR_LIMIT);
  if (!body.trim()) return null;
  return {
    id: message.id,
    threadId: message.threadId ?? message.id,
    at: new Date(Number(message.internalDate)).toISOString(),
    direction: partyOf(from, normalizeEmail(clientEmail), connectedEmails.map(normalizeEmail)),
    body,
  };
}

/** The newest messages, one per id, oldest first and numbered from 1. */
export function orderMessages(messages: LabelledMessage[], limit = MAX_THREAD_MESSAGES): TranscriptMessage[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const ordered = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return ordered.slice(Math.max(0, ordered.length - limit)).map((message, i) => ({ ...message, index: i + 1 }));
}

async function fetchFullMessage(id: string, headers: Record<string, string>): Promise<GmailFullMessage | null> {
  try {
    const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers });
    return res.ok ? await res.json() as GmailFullMessage : null;
  } catch {
    return null;
  }
}

/** The client's thread as a labelled transcript, or why there is none. */
export async function fetchEmailContext(email: string): Promise<EmailContext> {
  const tokens = await getValidTokens();
  if (!tokens) return UNAVAILABLE;
  const auth = `Bearer ${tokens.access_token}`;
  const headers = { Authorization: auth };
  const connectedEmails = await getConnectedAccountEmails(auth, tokens.email);
  const query = encodeURIComponent(`from:${email} OR to:${email}`);
  const searchRes = await fetch(`${GMAIL_API}/messages?q=${query}&maxResults=${MAX_SEARCH_RESULTS}`, { headers });
  if (!searchRes.ok) {
    console.error("Extension session facts: Gmail search failed", searchRes.status);
    return UNAVAILABLE;
  }
  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (searchData.messages ?? []).map((m) => m.id);
  const fetched = await Promise.all(ids.map((id) => fetchFullMessage(id, headers)));
  const labelled = fetched.flatMap((message) => (message ? toLabelledMessage(message, email, connectedEmails) ?? [] : []));
  const ordered = orderMessages(labelled);
  if (!ordered.length) return NONE;
  return { status: "read", context: renderTranscript(ordered), messageCount: ordered.length };
}
