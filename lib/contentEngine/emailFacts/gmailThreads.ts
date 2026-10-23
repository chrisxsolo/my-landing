// Server-side Gmail retrieval for session-fact extraction.
//
// Always a live fetch: the Auto-fill button must see the message the client
// sent five minutes ago, so nothing here is cached. Bodies are read (this is
// the one place in the codebase that needs them for a photography session),
// classified against the connected account's own addresses, cleaned of quoted
// replies, and grouped into threads. Logs carry ids and counts only — never
// email text.
import { mapWithConcurrency } from "@/lib/contentEngine/concurrency";
import { extractEmailText, type GmailMimePart } from "@/lib/gmailBodyText";
import { normalizeEmail } from "@/lib/inquiryReconcile";
import {
  groupIntoThreads, stripQuotedReply,
  type ConversationMessage, type ThreadCandidate,
} from "./conversation";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_MESSAGES = 60;
const FETCH_CONCURRENCY = 8;
const MAX_BODY_CHARS = 4000;
/** Never conversation state: unsent drafts, binned and junked mail. */
const EXCLUDED_LABELS = ["DRAFT", "TRASH", "SPAM"];

type GmailFullMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMimePart & { headers?: { name: string; value: string }[] };
};

function header(message: GmailFullMessage, name: string): string {
  return message.payload?.headers
    ?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchFullMessage(auth: string, id: string): Promise<GmailFullMessage | null> {
  try {
    const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) return null;
    return await res.json() as GmailFullMessage;
  } catch {
    return null;
  }
}

/**
 * One Gmail message → one conversation message, or null when it is not part
 * of the conversation (a draft, a payment processor's receipt, an empty body).
 */
export function toConversationMessage(
  message: GmailFullMessage,
  clientEmail: string,
  connectedEmails: string[],
): ConversationMessage | null {
  if (message.labelIds?.some((label) => EXCLUDED_LABELS.includes(label))) return null;
  if (!message.internalDate) return null;

  const from = normalizeEmail(header(message, "From"));
  if (!from.includes("@")) return null;

  const outbound = connectedEmails.some((email) => normalizeEmail(email) === from);
  const inbound = normalizeEmail(clientEmail) === from;
  // A third party in the thread (invoice bot, e-sign service) is neither side
  // of the conversation and must not be read as the client's word.
  if (!outbound && !inbound) return null;

  const raw = extractEmailText(message.payload, MAX_BODY_CHARS) || message.snippet || "";
  const body = stripQuotedReply(raw).slice(0, MAX_BODY_CHARS);
  if (!body.trim()) return null;

  return {
    gmailMessageId: message.id,
    threadId: message.threadId ?? message.id,
    at: new Date(Number(message.internalDate)).toISOString(),
    direction: outbound ? "photographer" : "client",
    subject: header(message, "Subject"),
    body,
  };
}

/**
 * Every message exchanged with this client, plus every message of the threads
 * already linked to the booking (a client who switched addresses mid-thread
 * is only reachable through the link).
 */
export async function fetchClientThreads(args: {
  auth: string;
  clientEmail: string;
  connectedEmails: string[];
  linkedThreadIds?: string[];
}): Promise<ThreadCandidate[]> {
  const { auth, clientEmail, connectedEmails } = args;
  const email = normalizeEmail(clientEmail);
  const query = `from:(${email}) OR to:(${email}) OR cc:(${email}) OR bcc:(${email})`;

  const listRes = await fetch(
    `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_MESSAGES}`,
    { headers: { Authorization: auth } },
  );
  // A failed search must fail loudly: extracting from an empty message set
  // would report "no conversation found" for a client who clearly has one.
  if (!listRes.ok) throw new Error(`Gmail search failed (${listRes.status})`);
  const listed = await listRes.json() as { messages?: { id: string }[] };

  const ids = new Set((listed.messages ?? []).map((m) => m.id));

  for (const threadId of args.linkedThreadIds ?? []) {
    try {
      const res = await fetch(`${GMAIL_API}/threads/${threadId}?format=minimal`, {
        headers: { Authorization: auth },
      });
      if (!res.ok) continue;
      const thread = await res.json() as { messages?: { id: string }[] };
      for (const message of thread.messages ?? []) ids.add(message.id);
    } catch {
      continue;
    }
  }

  const fetched = await mapWithConcurrency(
    [...ids].slice(0, MAX_MESSAGES), FETCH_CONCURRENCY,
    (id) => fetchFullMessage(auth, id),
  );

  const messages: ConversationMessage[] = [];
  for (const message of fetched) {
    if (!message) continue;
    const converted = toConversationMessage(message, email, connectedEmails);
    if (converted) messages.push(converted);
  }
  return groupIntoThreads(messages);
}
