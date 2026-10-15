// ─────────────────────────────────────────────────────────────────────────────
// Deterministic validation of a generated draft.
//
// Plain TypeScript, no second model call. Every check here is either a string
// match or a comparison against the verified context that produced the draft,
// which is why it costs nothing and cannot itself hallucinate.
//
// The honest limit: these checks catch format breaches and unsupported
// numbers. They cannot confirm that prose is true. When a claim is outside
// what can be checked, the draft is marked needsReview rather than valid —
// "validated" here never means "verified correct".
// ─────────────────────────────────────────────────────────────────────────────

import { BANNED_PHRASES } from "./soloxsnapsWritingProfile";
import type { EmailContext } from "./buildEmailContext";

export type IssueType =
  | "em_dash"
  | "uppercase_meridiem"
  | "signature_present"
  | "banned_phrase"
  | "markdown_formatting"
  | "bullet_list"
  | "emoji"
  | "missing_greeting"
  | "unsupported_price"
  | "unsupported_date"
  | "fabricated_booking_state"
  | "fabricated_payment"
  | "unanswered_question"
  | "truncated"
  | "too_long"
  | "paragraph_period"
  // ── Writing quality. These do not make a draft wrong, they make it one
  //    Chris would rewrite, which is the failure that actually costs him time.
  | "scenery_description"
  | "detail_echo"
  | "dangling_reference"
  | "duplicate_next_step"
  | "hourly_pricing"
  | "stale_greeting"
  | "marketing_language";

/**
 * Which kind of problem this is.
 *
 * Added because the UI reported "format and facts check out" and Chris
 * reasonably read that as "send it". Facts passing says nothing about whether
 * the email sounds like him, and conflating the two is what made the validator
 * feel like it was approving drafts it had never assessed.
 */
export type IssueCategory = "factual" | "format" | "style";

export type ValidationIssue = {
  type: IssueType;
  category: IssueCategory;
  severity: "high" | "medium" | "low";
  description: string;
  /** The offending text, when there is a specific fragment to show. */
  excerpt?: string;
};

export type ValidationResult = {
  /** No high-severity issues of any kind. */
  valid: boolean;
  /** True when something could not be checked deterministically. */
  needsReview: boolean;
  /** No high-severity factual or format breach. Says nothing about the prose. */
  factsVerified: boolean;
  /** Writing-quality flags. Advisory: a judgement, never a verification. */
  styleIssues: ValidationIssue[];
  issues: ValidationIssue[];
};

const SIGNATURE_PATTERNS = [
  /\n\s*(?:best|thanks|thank you|cheers|warm(?:est)? regards|regards|sincerely|talk soon)[,.!]?\s*\n+\s*chris\b/i,
  /\n\s*[-–—]\s*chris\s*$/i,
  /\n\s*chris\s*(?:solorzano)?\s*\n+\s*(?:soloxsnaps|photographer|www\.|http)/i,
  /\n\s*soloxsnaps(?:\s+photography)?\s*$/i,
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F0FF}]/u;

/** Money figures the draft states, in dollars. */
function extractPrices(draft: string): number[] {
  return [...draft.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
/** Abbreviations too: a real inquiry carried date_in_mind "Jul 19". */
const MONTH_ABBR = "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const MONTH_TO_INDEX: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};
const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Calendar dates the draft states, normalised to "month day". */
function extractDates(draft: string): string[] {
  return [...draft.matchAll(new RegExp(`\\b(${MONTHS}|${MONTH_ABBR})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"))]
    .map((match) => canonicalDate(match[1], match[2]))
    .filter((value): value is string => value !== null);
}

/** "Jul"/"July" + "19" → "july 19", so spellings compare equal. */
function canonicalDate(month: string, day: string): string | null {
  const index = MONTH_TO_INDEX[month.toLowerCase().replace(/\.$/, "")];
  return index ? `${MONTH_NAMES[index - 1]} ${Number(day)}` : null;
}

/**
 * Normalises any date spelling onto "month day".
 *
 * Handles both an availability label ("Mon, October 26, 2026") and an ISO date,
 * because the inquiry form stores `date_in_mind` as "2026-10-18" — missing that
 * form would flag the client's own requested date as unsupported every time
 * the draft declined it.
 */
function normalizeDateMention(value: string): string | null {
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const monthName = MONTH_NAMES[Number(iso[2]) - 1];
    return monthName ? `${monthName} ${Number(iso[3])}` : null;
  }
  const named = value.match(new RegExp(`(${MONTHS}|${MONTH_ABBR})\\.?\\s+(\\d{1,2})`, "i"));
  if (named) return canonicalDate(named[1], named[2]);
  return normalizeSlashDate(value);
}

/**
 * "5/24" and "5/24/26" onto "may 24".
 *
 * A real date_in_mind read "5/24 @5:30pm, 5/25 @5:30pm, 5/26 @5:30pm", and a
 * draft that correctly said it could not confirm May 24th was flagged for
 * naming a date nobody had mentioned.
 */
function normalizeSlashDate(value: string): string | null {
  const match = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

/** Every slash date in a block of text, normalised. */
function slashDatesIn(text: string): string[] {
  return [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g)]
    .map((match) => normalizeSlashDate(match[0]))
    .filter((value): value is string => value !== null);
}

/** Every date the client themselves named, in any of their own text. */
function clientRaisedDates(context: EmailContext): Set<string> {
  const raised = new Set<string>();

  const add = (value: string | null | undefined) => {
    const normalized = value ? normalizeDateMention(value) : null;
    if (normalized) raised.add(normalized);
  };

  for (const date of context.thread.digest.datesDiscussed) add(date);
  add(context.request.dateInMind);

  // The inquiry form message is NOT part of the Gmail thread, so dates written
  // there never reached the thread digest. A draft answering "your September 1
  // deadline is earlier than my open dates" was flagged for naming a date the
  // client had supplied themselves.
  for (const match of context.request.rawMessage.matchAll(
    new RegExp(`\\b(${MONTHS}|${MONTH_ABBR})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"),
  )) {
    const canonical = canonicalDate(match[1], match[2]);
    if (canonical) raised.add(canonical);
  }

  // Every field the client typed into, because they do not always use the one
  // we expect: a real inquiry put "September 28" in the LOCATION field and
  // left date_in_mind empty, and the draft was flagged for naming it.
  const clientText = [
    context.request.rawMessage,
    context.request.dateInMind ?? "",
    context.request.location ?? "",
    context.request.preferredTime ?? "",
  ].join(" \n ");

  for (const date of slashDatesIn(clientText)) raised.add(date);
  for (const match of clientText.matchAll(
    new RegExp(`\\b(${MONTHS}|${MONTH_ABBR})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"),
  )) {
    const canonical = canonicalDate(match[1], match[2]);
    if (canonical) raised.add(canonical);
  }

  return raised;
}

/** Non-empty paragraphs, trimmed. */
function trimmedParagraphs(draft: string): string[] {
  return draft.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
}

function checkFormatting(draft: string, firstName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (draft.includes("—") || draft.includes("–")) {
    issues.push({ type: "em_dash", category: "format", severity: "high", description: "Contains an em or en dash." });
  }

  const upperMeridiem = draft.match(/\b\d{1,2}(?::\d{2})?\s?(?:AM|PM|A\.M\.|P\.M\.)\b/);
  if (upperMeridiem) {
    issues.push({
      type: "uppercase_meridiem", category: "format", severity: "high",
      description: 'Times must be lowercase, like "5:30 pm".',
      excerpt: upperMeridiem[0],
    });
  }

  const signature = SIGNATURE_PATTERNS.find((pattern) => pattern.test(draft));
  if (signature) {
    issues.push({
      type: "signature_present", category: "format", severity: "high",
      description: "Ends with a sign-off or signature. Gmail adds that, so this one would duplicate it.",
    });
  }

  for (const phrase of BANNED_PHRASES) {
    if (draft.toLowerCase().includes(phrase)) {
      issues.push({
        type: "banned_phrase", category: "style", severity: "medium",
        description: "Uses corporate boilerplate.", excerpt: phrase,
      });
    }
  }

  if (/(?:^|\n)\s*(?:\*\*|##|###)|\*\*\w/.test(draft)) {
    issues.push({ type: "markdown_formatting", category: "format", severity: "high", description: "Contains markdown formatting." });
  }
  if (/(?:^|\n)\s*(?:[-*•]\s+\S|\d+\.\s+\S)/.test(draft)) {
    issues.push({
      type: "bullet_list", category: "format", severity: "medium",
      description: "Contains a bulleted or numbered list. Availability belongs in a sentence.",
    });
  }
  if (EMOJI.test(draft)) {
    issues.push({ type: "emoji", category: "format", severity: "medium", description: "Contains an emoji." });
  }

  // Paragraphs are normalised by stripParagraphPeriods before this runs, so a
  // survivor is an abbreviation case left alone on purpose — worth showing,
  // not worth blocking.
  const periodEnded = trimmedParagraphs(draft).filter((block) => /\.$/.test(block));
  if (periodEnded.length) {
    issues.push({
      type: "paragraph_period", category: "format", severity: "low",
      description: "A paragraph ends with a period, which Chris does not do.",
      excerpt: periodEnded[0].slice(-40),
    });
  }

  const greeting = new RegExp(`^\\s*(?:hi|hey|hello)\\s+${firstName}\\b`, "i");
  if (!greeting.test(draft)) {
    issues.push({
      type: "missing_greeting", category: "format", severity: "medium",
      description: `Does not open with "Hi ${firstName},".`,
    });
  }
  return issues;
}

/** Travel fees and policy figures, pulled from the prose that states them. */
function auxiliaryPrices(context: EmailContext): number[] {
  return extractPrices([context.pricing.travelFact ?? "", ...context.policy].join(" "));
}

/**
 * Whether the draft may state this price.
 *
 * Legitimate: an exact catalog figure, a price already quoted in this thread,
 * or a session base plus any combination of add-ons and the travel fee — that
 * last case is a real total the model is allowed to compute.
 *
 * Deliberately NOT legitimate: a sum of add-ons with no session base. Add-ons
 * are never sold alone, so "$175" matching "extra 30 minutes plus extra
 * outfit" is a coincidence, not a quote — which is how a discount slips past a
 * looser check.
 */
function isSupportedPrice(price: number, context: EmailContext): boolean {
  const { basePrices, addOnPrices } = context.pricing;

  const exact = new Set<number>([...basePrices, ...addOnPrices, ...auxiliaryPrices(context)]);
  for (const quoted of context.thread.digest.quotedPrices) {
    const value = Number(quoted.replace(/[$,]/g, ""));
    if (Number.isFinite(value)) exact.add(value);
  }
  if (exact.has(price)) return true;
  if (!basePrices.length) return false;

  // Subset sum over the add-ons, which number at most a handful.
  const extras = [...addOnPrices, ...auxiliaryPrices(context)];
  let reachable = new Set<number>(basePrices);
  for (const extra of extras) {
    const next = new Set(reachable);
    for (const total of reachable) next.add(total + extra);
    reachable = next;
  }
  return reachable.has(price);
}

function checkFacts(draft: string, context: EmailContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // ── Prices ────────────────────────────────────────────────────────────────
  for (const price of extractPrices(draft)) {
    if (isSupportedPrice(price, context)) continue;
    issues.push({
      type: "unsupported_price", category: "factual", severity: "high",
      description: "States a price that is not in the rate card and was not quoted earlier in this thread.",
      excerpt: `$${price}`,
    });
  }

  // ── Dates ─────────────────────────────────────────────────────────────────
  if (context.availability.verified) {
    const offerable = new Set(
      context.availability.offerable
        .map((entry) => normalizeDateMention(entry.label))
        .filter((value): value is string => value !== null),
    );
    // A date the client themselves raised may be discussed, including to say no.
    const clientRaised = clientRaisedDates(context);
    // Unavailable dates are nameable too — the draft has to be able to rule out
    // a date Chris cannot shoot.
    for (const entry of context.availability.unavailable) {
      const normalized = normalizeDateMention(entry.label);
      if (normalized) clientRaised.add(normalized);
    }

    for (const date of extractDates(draft)) {
      if (offerable.has(date) || clientRaised.has(date)) continue;
      issues.push({
        type: "unsupported_date", category: "factual", severity: "high",
        description: "Names a date that is not on the open list and was never discussed.",
        excerpt: date,
      });
    }
  }

  // ── Booking state ─────────────────────────────────────────────────────────
  const claimsSent = /\b(?:just |already )?sent (?:you |over |out )?(?:the |your )?(?:invoice|contract)/i.test(draft)
    || /\b(?:invoice|contract) (?:is|has been) (?:sent|attached|on its way)\b/i.test(draft);
  if (claimsSent && context.thread.digest.invoice !== "sent" && context.thread.digest.contract !== "sent") {
    issues.push({
      type: "fabricated_booking_state", category: "factual", severity: "high",
      description: "Says the invoice or contract was sent, but nothing in the thread shows it was.",
    });
  }

  const claimsPaid = /\b(?:deposit|retainer|payment)\b[^.!?]{0,40}\b(?:received|came through|went through|confirmed)\b/i.test(draft)
    || /\byour (?:session|date) is (?:confirmed|booked|secured)\b/i.test(draft);
  if (claimsPaid && !context.thread.digest.depositPaid) {
    issues.push({
      type: "fabricated_payment", category: "factual", severity: "high",
      description: "Treats the booking as paid or confirmed with no evidence of a deposit.",
    });
  }

  return issues;
}

/** Flags a client question the draft never addresses. */
function checkQuestionsAnswered(draft: string, context: EmailContext): ValidationIssue[] {
  const draftWords = new Set(draft.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/));
  const stopWords = new Set([
    "the","a","an","is","are","do","does","can","could","would","will","you",
    "your","i","we","my","me","and","or","to","for","of","in","on","at","it",
    "that","this","have","has","be","any","if","so","what","when","where","how",
  ]);

  const issues: ValidationIssue[] = [];
  for (const question of context.thread.digest.openQuestions) {
    const keywords = question
      .toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));
    if (!keywords.length) continue;

    // Prefix-matched, so an answer worded differently still counts: a draft
    // that says "for prep, I'd go with soft colors" does answer "any tips for
    // preparing?", and exact matching called it unanswered.
    const draftList = [...draftWords];
    const covered = keywords.filter((word) => {
      if (draftWords.has(word)) return true;
      const stem = word.slice(0, 4);
      return draftList.some((candidate) => candidate.length > 3 && candidate.startsWith(stem));
    }).length / keywords.length;
    if (covered < 0.34) {
      issues.push({
        type: "unanswered_question", category: "style", severity: "medium",
        description: "A question in their latest email looks unanswered.",
        excerpt: question,
      });
    }
  }
  return issues;
}


// ── Writing quality ─────────────────────────────────────────────────────────
// Deterministic, cheap, and honest about what it is: these flag prose Chris
// has told us he rewrites. They are advisory. Nothing here proves an email is
// good, and a clean run does not mean "send it".

/** Sentences predicting how the photos, light, or a place will look. */
const SCENERY = [
  /\b(?:the )?light(?:ing)? (?:is going to|will|would) (?:be|look)\b/i,
  /\b(?:it|that|this|they)'?(?:ll| will| would)? (?:look|turn out) (?:great|amazing|beautiful|lovely|stunning|gorgeous|incredible)\b/i,
  /\b(?:should|will) be a (?:beautiful|lovely|gorgeous|great|stunning) (?:evening|morning|day|time)\b/i,
  /\bgoing to be (?:lovely|beautiful|gorgeous|stunning|magical)\b/i,
  /\b(?:such a|what a) (?:beautiful|gorgeous|stunning|lovely) (?:spot|backdrop|setting|location)\b/i,
];

/** Soft marketing register that is not a fixed banned phrase. */
const MARKETING = [
  /\bperfect (?:backdrop|setting)\b/i,
  /\bcan'?t wait to (?:capture|create)\b/i,
  /\bunforgettable\b/i,
  /\btruly special\b/i,
  /\bone of a kind (?:experience|session)\b/i,
];

/** A reference to information the draft then fails to supply. */
const DANGLING = [
  { pattern: /\bhere'?s my (?:number|phone|cell)\b/i, satisfied: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/ },
  { pattern: /\b(?:here'?s|i'?ll send) the (?:link|pin)\b/i, satisfied: /https?:\/\/|maps\.app|goo\.gl/i },
  { pattern: /\byou can (?:text|call|reach) me at\b/i, satisfied: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/ },
];

/** Describing a place the client themselves named. */
function checkDetailEcho(draft: string, context: EmailContext): ValidationIssue[] {
  const named = (context.request.location ?? "").trim();
  if (named.length < 4) return [];

  // The distinctive word in what they called the place: "Rockaway Beach" →
  // "rockaway". Generic words are skipped so "beach" alone cannot trigger.
  const generic = new Set(["beach", "park", "campus", "garden", "gardens", "city", "hall", "the", "and", "in", "at", "san", "francisco", "building", "steps", "main", "inside", "possible", "front", "stair"]);
  const words = named.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !generic.has(w));
  if (!words.length) return [];

  const issues: ValidationIssue[] = [];
  for (const sentence of draft.split(/(?<=[.!?])\s+|\n/)) {
    if (!words.some((w) => sentence.toLowerCase().includes(w))) continue;
    // Praising or describing it, rather than using it as a fact.
    if (!/\b(?:sounds like|is|are|has|have|would be|such a) (?:a )?(?:lovely|beautiful|great|perfect|gorgeous|stunning|amazing|wonderful|fun)\b/i.test(sentence)) continue;
    issues.push({
      type: "detail_echo", category: "style", severity: "medium",
      description: "Describes a location the client chose themselves. Chris does not read their own details back to them.",
      excerpt: sentence.trim().slice(0, 90),
    });
    break;
  }
  return issues;
}

/** The booking step stated more than once. */
function checkDuplicateNextStep(draft: string): ValidationIssue[] {
  const mentions = [...draft.matchAll(/\b(?:invoice|contract)\b/gi)].length;
  const asks = [...draft.matchAll(/\blet me know\b/gi)].length;
  const issues: ValidationIssue[] = [];

  // Two separate paragraphs each carrying a next step.
  const paragraphs = trimmedParagraphs(draft);
  const closingish = paragraphs.filter((block) =>
    /\blet me know\b/i.test(block) || /\b(?:invoice|contract)\b/i.test(block),
  );
  if (closingish.length > 1 && (mentions >= 1 && asks >= 1)) {
    issues.push({
      type: "duplicate_next_step", category: "style", severity: "medium",
      description: "The ask and the booking step are in two paragraphs. Chris puts them in one sentence.",
      excerpt: closingish[closingish.length - 1].slice(0, 90),
    });
  }
  return issues;
}

function checkWritingQuality(draft: string, context: EmailContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const pattern of SCENERY) {
    const hit = draft.match(pattern);
    if (!hit) continue;
    issues.push({
      type: "scenery_description", category: "style", severity: "medium",
      description: "Predicts how the photos or the light will look. Chris gives timing advice, not scenery commentary.",
      excerpt: hit[0],
    });
    break;
  }

  for (const pattern of MARKETING) {
    const hit = draft.match(pattern);
    if (!hit) continue;
    issues.push({
      type: "marketing_language", category: "style", severity: "low",
      description: "Reads as photography marketing rather than a person replying.",
      excerpt: hit[0],
    });
    break;
  }

  for (const { pattern, satisfied } of DANGLING) {
    const hit = draft.match(pattern);
    if (!hit || satisfied.test(draft)) continue;
    issues.push({
      type: "dangling_reference", category: "style", severity: "high",
      description: "Offers a phone number or link and then does not give it.",
      excerpt: hit[0],
    });
  }

  // Graduation is a package that starts at a price, not an hourly rate.
  if (context.client.playbook === "graduation" && /\$\s?\d+\s*(?:per hour|\/\s?hour|\/\s?hr|an hour|a hour)/i.test(draft)) {
    issues.push({
      type: "hourly_pricing", category: "style", severity: "medium",
      description: 'Quotes graduation as an hourly rate. Chris writes "my graduation sessions start at $350".',
      excerpt: (draft.match(/\$\s?\d+\s*(?:per hour|\/\s?hour|\/\s?hr|an hour)/i) ?? [""])[0],
    });
  }

  // A first-reply opening on a conversation that is already running.
  const stage = context.conversation.stage;
  if (stage !== "initial_inquiry" && context.thread.digest.messageCount > 1
      && /thank you so much for reaching out/i.test(draft)) {
    issues.push({
      type: "stale_greeting", category: "style", severity: "medium",
      description: `Opens like a first reply, but this is a ${stage.replace(/_/g, " ")} message.`,
      excerpt: "Thank you so much for reaching out",
    });
  }

  // Past the stage's own length budget, which is read off his sent mail.
  const [, maxWords] = context.conversation.shape.targetWords;
  const wordCount = draft.split(/\s+/).filter(Boolean).length;
  if (wordCount > maxWords * 1.4) {
    issues.push({
      type: "too_long", category: "style", severity: "medium",
      description: `${wordCount} words. At this stage Chris writes ${context.conversation.shape.targetWords[0]} to ${maxWords}.`,
    });
  }

  issues.push(...checkDetailEcho(draft, context));
  issues.push(...checkDuplicateNextStep(draft));
  return issues;
}

export const MAX_REASONABLE_WORDS = 260;

export function validateEmailDraft(
  draft: string,
  context: EmailContext,
  stopReason: string | null = null,
): ValidationResult {
  const trimmed = draft.trim();
  const issues: ValidationIssue[] = [];

  if (stopReason === "max_tokens") {
    issues.push({
      type: "truncated", category: "factual", severity: "high",
      description: "Claude hit the output limit, so this draft is cut off. Do not send it.",
    });
  }

  issues.push(
    ...checkFormatting(trimmed, context.client.firstName),
    ...checkFacts(trimmed, context),
    ...checkQuestionsAnswered(trimmed, context),
    ...checkWritingQuality(trimmed, context),
  );

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_REASONABLE_WORDS) {
    issues.push({
      type: "too_long", category: "style", severity: "low",
      description: `${wordCount} words. Chris's replies run shorter than this.`,
    });
  }

  // Anything the context itself could not verify leaves correctness open, no
  // matter how clean the string checks came out.
  const unverifiedContext = context.warnings.some((warning) => warning.severity === "high");

  const styleIssues = issues.filter((issue) => issue.category === "style");
  const factsVerified = !issues.some(
    (issue) => issue.severity === "high" && issue.category !== "style",
  );

  return {
    valid: !issues.some((issue) => issue.severity === "high"),
    needsReview: unverifiedContext || issues.length > 0,
    factsVerified,
    styleIssues,
    issues,
  };
}
