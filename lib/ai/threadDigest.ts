// ─────────────────────────────────────────────────────────────────────────────
// Deterministic reading of an email thread.
//
// The old prompt dumped every message into the context and hoped the model
// worked out where the booking stood. It frequently decided an invoice had
// been sent because Chris had written "I'll send the invoice over" — a promise
// read as an event.
//
// This extracts the facts with regexes and distinguishes PROMISED from SENT,
// so the prompt can state booking state rather than imply it. No model call:
// an LLM summariser here would cost a second request per draft and could still
// hallucinate the thing it was called to pin down.
// ─────────────────────────────────────────────────────────────────────────────

import { parseKnownMoneyCents } from "@/lib/paymentTotalInference";
import { formatCents } from "@/lib/confirmationPricing";

export type ThreadMessage = {
  /** ISO timestamp or any Date-parseable string. */
  timestamp: string | number;
  fromMe: boolean;
  body: string;
};

/** Tri-state because "he said he would" is not "he did". */
export type EventState = "none" | "promised" | "sent";

export type ThreadDigest = {
  messageCount: number;
  /** Days since the newest message, or null when the thread is empty. */
  daysSinceLastMessage: number | null;
  /** True when the client is waiting on Chris. */
  awaitingChrisReply: boolean;
  invoice: EventState;
  contract: EventState;
  /** Only ever set from the client confirming receipt or Chris acknowledging it. */
  depositPaid: boolean;
  /** Prices Chris quoted, most recent message first, formatted as "$450". */
  quotedPrices: string[];
  /** Dates discussed as free text, in the order they appeared. */
  datesDiscussed: string[];
  /** Client questions still unanswered in the newest client message. */
  openQuestions: string[];
};

const DAY_MS = 86_400_000;

/**
 * Chris saying he will do something later.
 *
 * The modal forms matter as much as "I'll": his standard closing line is
 * "once we decide on the date, time and location, I can send over the invoice
 * and contract to secure the session". Without "I can" this read as no
 * invoice having been mentioned at all, so the next draft re-explained the
 * booking step he had already explained.
 */
const PROMISE_PATTERNS = [
  /\b(?:i'?ll|i will|going to|gonna|let me)\s+(?:go ahead and\s+)?(?:send|get|shoot)\b/i,
  /\b(?:i can|i could|i'?d be happy to|happy to|i'?d love to)\s+(?:go ahead and\s+)?(?:send|get|shoot)\b/i,
  /\bonce (?:we|you)\b[^.!?]*\b(?:i'?ll|i can)\b/i,
];

/** Chris saying he already did it. */
const SENT_PATTERNS = [
  /\b(?:just|already)?\s*sent (?:you |over |out )?(?:the |your |an? )?/i,
  /\bhere'?s (?:the|your)\b/i,
  /\bis attached\b/i,
  /\byou should (?:have|see) (?:it|the)\b/i,
];

const INVOICE_WORD = /\binvoice|\bdeposit link|\bpayment link|\bretainer\b/i;
const CONTRACT_WORD = /\bcontract|\bagreement\b/i;

/**
 * Classifies whether a document was promised or actually sent.
 *
 * Only Chris's own messages count: a client writing "did you send the invoice?"
 * is evidence it has NOT arrived. Newest evidence wins, and "sent" never
 * downgrades to "promised" once seen.
 */
function classifyDocument(messages: ThreadMessage[], word: RegExp): EventState {
  let state: EventState = "none";

  for (const message of messages) {
    if (!message.fromMe) continue;
    for (const sentence of message.body.split(/(?<=[.!?\n])/)) {
      if (!word.test(sentence)) continue;
      if (SENT_PATTERNS.some((p) => p.test(sentence))) return "sent";
      if (PROMISE_PATTERNS.some((p) => p.test(sentence))) state = "promised";
    }
  }
  return state;
}

/**
 * Deposit evidence. Deliberately strict: an unpaid booking that the AI
 * announces as paid is the single most embarrassing failure available here.
 */
function detectDepositPaid(messages: ThreadMessage[]): boolean {
  const clientPaid = /\b(?:just )?(?:paid|sent (?:the |over the )?(?:deposit|retainer|payment)|venmo(?:ed|'?d)?|zelle(?:d)?|transferred)\b/i;
  const chrisConfirmed = /\b(?:deposit|retainer|payment)\b[^.!?]{0,40}\b(?:received|came through|went through|confirmed|got it)\b/i;

  return messages.some((m) =>
    m.fromMe ? chrisConfirmed.test(m.body) : clientPaid.test(m.body),
  );
}

/** Prices Chris named, most recent message first, de-duplicated. Within a
 *  single message they stay in reading order. */
function extractQuotedPrices(messages: ThreadMessage[]): string[] {
  const seen = new Set<string>();
  const prices: string[] = [];

  for (const message of [...messages].reverse()) {
    if (!message.fromMe) continue;
    for (const match of message.body.matchAll(/\$\s?[\d,]+(?:\.\d{2})?/g)) {
      const cents = parseKnownMoneyCents(match[0]);
      // Every figure Chris named counts, add-ons included: a $75 extra outfit
      // quoted last week is exactly the number the next draft must not
      // contradict. Only a failed parse is dropped.
      if (cents <= 0) continue;
      const formatted = formatCents(cents);
      if (seen.has(formatted)) continue;
      seen.add(formatted);
      prices.push(formatted);
    }
  }
  return prices;
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

/** Dates named anywhere in the thread, in reading order. */
function extractDatesDiscussed(messages: ThreadMessage[]): string[] {
  const seen = new Set<string>();
  const dates: string[] = [];
  const patterns = [
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "gi"),
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
    /\b(?:this|next)\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/gi,
  ];

  for (const message of messages) {
    for (const pattern of patterns) {
      for (const match of message.body.matchAll(pattern)) {
        const key = match[0].toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) continue;
        seen.add(key);
        dates.push(match[0].trim());
      }
    }
  }
  return dates;
}

/**
 * Questions from the newest client message.
 *
 * Only the newest message, because older questions were almost certainly
 * answered — and listing them invites the model to answer them twice.
 */
function extractOpenQuestions(messages: ThreadMessage[]): string[] {
  const lastClientMessage = [...messages].reverse().find((m) => !m.fromMe);
  if (!lastClientMessage) return [];

  // Split on every sentence end, not only on "?". A client who writes a
  // paragraph and finishes it with a question used to yield the whole
  // paragraph as one "question", and the keyword-coverage check then reported
  // it unanswered no matter what the draft said.
  return lastClientMessage.body
    .split(/(?<=[.!?])\s+|\n/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.endsWith("?") && sentence.length > 8)
    .slice(0, 5);
}

export function buildThreadDigest(
  messages: ThreadMessage[],
  now: Date = new Date(),
): ThreadDigest {
  const ordered = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const newest = ordered.at(-1);

  const lastMs = newest ? new Date(newest.timestamp).getTime() : NaN;
  const daysSinceLastMessage = Number.isFinite(lastMs)
    ? Math.max(0, Math.floor((now.getTime() - lastMs) / DAY_MS))
    : null;

  return {
    messageCount: ordered.length,
    daysSinceLastMessage,
    awaitingChrisReply: Boolean(newest && !newest.fromMe),
    invoice: classifyDocument(ordered, INVOICE_WORD),
    contract: classifyDocument(ordered, CONTRACT_WORD),
    depositPaid: detectDepositPaid(ordered),
    quotedPrices: extractQuotedPrices(ordered),
    datesDiscussed: extractDatesDiscussed(ordered),
    openQuestions: extractOpenQuestions(ordered),
  };
}

/** Renders the digest as prompt lines. Only known facts appear. */
export function renderThreadDigest(digest: ThreadDigest): string[] {
  if (digest.messageCount === 0) return ["No prior email history with this client."];

  const documentState = (state: EventState, noun: string): string => {
    if (state === "sent") return `The ${noun} has been sent.`;
    if (state === "promised") return `Chris said he would send the ${noun}, but there is no evidence it was actually sent. Do not say it has been sent.`;
    return `No ${noun} has been mentioned.`;
  };

  const lines = [
    `${digest.messageCount} prior message${digest.messageCount === 1 ? "" : "s"} in this thread.`,
    documentState(digest.invoice, "invoice"),
    documentState(digest.contract, "contract"),
    digest.depositPaid
      ? "The thread shows a deposit was paid."
      : "There is no evidence in the thread that a deposit was paid. Do not treat this booking as confirmed.",
  ];

  if (digest.quotedPrices.length) {
    // The "do not restate" half matters as much as the "do not contradict"
    // half. A client who asked a one-line availability question got the price
    // and the whole booking step read back at them: 93 words where Chris
    // wrote 39.
    lines.push(`Prices Chris already quoted in this thread, most recent message first: ${digest.quotedPrices.join(", ")}. Do not contradict these, and do not restate them unless they ask about price again. They already have the number.`);
  }
  if (digest.invoice !== "none" || digest.contract !== "none") {
    lines.push("Chris has already explained how booking works in this thread. Do not explain the invoice and contract step again unless they ask, or unless this email is the one settling the booking.");
  }
  if (digest.datesDiscussed.length) {
    lines.push(`Dates already discussed: ${digest.datesDiscussed.slice(0, 12).join(", ")}.`);
  }
  if (digest.daysSinceLastMessage !== null && digest.daysSinceLastMessage >= 3 && digest.awaitingChrisReply) {
    lines.push(`The client has been waiting ${digest.daysSinceLastMessage} days for a reply. Open by apologising once for the delay.`);
  }
  if (digest.openQuestions.length) {
    lines.push(`Questions in their latest email that must be answered: ${digest.openQuestions.map((q) => `"${q}"`).join(" ")}`);
  }
  return lines;
}
