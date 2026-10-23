// Turning a client's Gmail mail into one analyzable conversation.
//
// Three jobs, all pure so they are testable without Gmail:
//   1. strip the parts of a message that are not new text (quoted replies,
//      forwarded blocks, signatures) without ever dropping a message;
//   2. order every message oldest → newest and number it, because the
//      extractor reasons about "latest confirmed" and cites message numbers;
//   3. decide WHICH thread belongs to this booking — a client with a May
//      graduation and a September couples session has two, and mixing them is
//      the failure the spec calls out.
import type { ServiceType } from "@/lib/contentEngine/taxonomy";

export type MessageDirection = "client" | "photographer";

export interface ConversationMessage {
  gmailMessageId: string;
  threadId: string;
  at: string;
  direction: MessageDirection;
  subject: string;
  body: string;
}

/** A numbered message as the model sees it. */
export interface NumberedMessage extends ConversationMessage {
  index: number;
}

export interface ThreadCandidate {
  threadId: string;
  subject: string;
  messages: ConversationMessage[];
  firstAt: string;
  lastAt: string;
  lastMessageId: string;
}

/** What we already know about this booking, used to pick its thread. */
export interface ThreadHints {
  serviceType?: ServiceType | string | null;
  sessionDate?: string | null;
  primaryLocation?: string | null;
}

// ─── 1. message cleanup ──────────────────────────────────────────────────────

const QUOTE_MARKERS = [
  // "On Tue, Oct 8, 2026 at 5:30 PM Chris <…> wrote:" and its localized kin
  /^\s*on\s.{0,200}\swrote:\s*$/im,
  /^\s*-{2,}\s*original message\s*-{2,}\s*$/im,
  /^\s*-{2,}\s*forwarded message\s*-{2,}\s*$/im,
  /^\s*from:\s.{0,200}\nsent:\s/im,
  /^\s*_{10,}\s*$/m,
];

const SIGNATURE_MARKERS = [
  /^\s*--\s*$/m,
  /^\s*sent from my (?:iphone|ipad|android|mobile|galaxy)\b.*$/im,
  /^\s*get outlook for \w+\s*$/im,
];

/**
 * The new text of a message: everything before the first quote marker, with
 * quoted lines and a trailing signature removed.
 *
 * Never returns empty for a non-empty input — a reply that is nothing but
 * "Sounds good!" above a quote still carries the confirmation the extractor
 * needs, and a message whose cleanup removes everything falls back to its
 * raw text rather than vanishing from the conversation.
 */
export function stripQuotedReply(body: string): string {
  if (!body.trim()) return "";
  let text = body.replace(/\r\n/g, "\n");

  let cut = text.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(text);
    if (match && match.index < cut) cut = match.index;
  }
  text = text.slice(0, cut);

  text = text
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");

  for (const marker of SIGNATURE_MARKERS) {
    const match = marker.exec(text);
    if (match) text = text.slice(0, match.index);
  }

  const trimmed = text.replace(/\n{3,}/g, "\n\n").trim();
  return trimmed || body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Oldest → newest, one entry per Gmail message id, numbered from 1. A message
 * whose cleaned text repeats the message right before it (same direction) is
 * dropped as a duplicate send; nothing else is removed, so no unique
 * scheduling text can be lost.
 */
export function numberConversation(messages: ConversationMessage[]): NumberedMessage[] {
  const byId = new Map<string, ConversationMessage>();
  for (const message of messages) {
    if (!message.body.trim()) continue;
    if (!byId.has(message.gmailMessageId)) byId.set(message.gmailMessageId, message);
  }
  const ordered = [...byId.values()].sort(
    (a, b) => a.at.localeCompare(b.at) || a.gmailMessageId.localeCompare(b.gmailMessageId),
  );

  const kept: ConversationMessage[] = [];
  for (const message of ordered) {
    const previous = kept[kept.length - 1];
    const sameText = previous
      && previous.direction === message.direction
      && previous.body.trim() === message.body.trim();
    if (sameText) continue;
    kept.push(message);
  }
  return kept.map((message, i) => ({ ...message, index: i + 1 }));
}

// ─── 2. thread selection ─────────────────────────────────────────────────────

const SERVICE_HINTS: Partial<Record<ServiceType, RegExp>> = {
  grads: /\b(?:grad|graduation|commencement|cap and gown|regalia)\b/i,
  couples: /\b(?:couple|couples|engagement|engaged|anniversary|proposal|date night)\b/i,
  families: /\b(?:family|families|kids|children|grandparents)\b/i,
  portraits: /\b(?:portrait|portraits|headshot|headshots|personal brand)\b/i,
  maternity: /\b(?:maternity|pregnan|baby bump)\b/i,
  prom: /\bprom\b/i,
  events: /\b(?:event|party|birthday|reception|ceremony)\b/i,
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** The ways a YYYY-MM-DD date plausibly appears in prose. */
function datePhrases(iso: string): RegExp[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return [];
  const [, , m, d] = match;
  const month = MONTHS[Number(m) - 1];
  const day = Number(d);
  if (!month) return [];
  return [
    new RegExp(iso, "i"),
    new RegExp(`${month.slice(0, 3)}\\w*\\.?\\s+${day}\\b`, "i"),
    new RegExp(`\\b${Number(m)}\\s*/\\s*${day}\\b`),
  ];
}

export interface RankedThread {
  candidate: ThreadCandidate;
  score: number;
}

/**
 * Score each thread on how much of what we already know it actually contains.
 * Service wording, the known session date and the known location are the three
 * signals that tell one booking's thread from another's.
 */
export function rankThreadCandidates(
  candidates: ThreadCandidate[],
  hints: ThreadHints,
): RankedThread[] {
  const ranked = candidates.map((candidate) => {
    const text = [candidate.subject, ...candidate.messages.map((m) => m.body)].join("\n");
    let score = 0;

    const serviceHint = hints.serviceType
      ? SERVICE_HINTS[hints.serviceType as ServiceType]
      : undefined;
    if (serviceHint?.test(text)) score += 3;

    if (hints.sessionDate && datePhrases(hints.sessionDate).some((re) => re.test(text))) score += 3;

    const location = hints.primaryLocation?.trim();
    if (location && location.length > 3 && text.toLowerCase().includes(location.toLowerCase())) {
      score += 2;
    }
    return { candidate, score };
  });

  return ranked.sort(
    (a, b) => b.score - a.score || b.candidate.lastAt.localeCompare(a.candidate.lastAt),
  );
}

export type ThreadChoice =
  | { outcome: "chosen"; threads: ThreadCandidate[] }
  | { outcome: "ambiguous"; candidates: RankedThread[] };

/**
 * Pick the thread(s) to analyze, or hand the decision back.
 *
 * `linkedThreadIds` are threads already tied to this booking's inquiry — an
 * explicit link always wins and several linked threads are analyzed together.
 * Otherwise one candidate is used as-is, and among several the top thread must
 * both match something we know and beat the runner-up clearly. Anything less
 * is ambiguous: guessing risks pulling a different photoshoot's details in.
 */
export function chooseThreads(
  candidates: ThreadCandidate[],
  hints: ThreadHints,
  linkedThreadIds: string[] = [],
): ThreadChoice {
  const linked = candidates.filter((c) => linkedThreadIds.includes(c.threadId));
  if (linked.length) return { outcome: "chosen", threads: linked };
  if (candidates.length === 0) return { outcome: "chosen", threads: [] };
  if (candidates.length === 1) return { outcome: "chosen", threads: candidates };

  const ranked = rankThreadCandidates(candidates, hints);
  const [top, second] = ranked;
  if (top.score >= 3 && top.score - second.score >= 2) {
    return { outcome: "chosen", threads: [top.candidate] };
  }
  return { outcome: "ambiguous", candidates: ranked };
}

/** Group loose messages into thread candidates, newest activity first. */
export function groupIntoThreads(messages: ConversationMessage[]): ThreadCandidate[] {
  const byThread = new Map<string, ConversationMessage[]>();
  for (const message of messages) {
    const list = byThread.get(message.threadId);
    if (list) list.push(message);
    else byThread.set(message.threadId, [message]);
  }

  const candidates: ThreadCandidate[] = [];
  for (const [threadId, list] of byThread) {
    const ordered = numberConversation(list);
    if (!ordered.length) continue;
    const last = ordered[ordered.length - 1];
    candidates.push({
      threadId,
      subject: ordered[0].subject,
      // Numbering belongs to the final transcript, not to a candidate: the
      // chosen thread (or threads together) is numbered once, at that point.
      messages: ordered.map((message) => ({
        gmailMessageId: message.gmailMessageId,
        threadId: message.threadId,
        at: message.at,
        direction: message.direction,
        subject: message.subject,
        body: message.body,
      })),
      firstAt: ordered[0].at,
      lastAt: last.at,
      lastMessageId: last.gmailMessageId,
    });
  }
  return candidates.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
