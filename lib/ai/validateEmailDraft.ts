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
  | "too_long";

export type ValidationIssue = {
  type: IssueType;
  severity: "high" | "medium" | "low";
  description: string;
  /** The offending text, when there is a specific fragment to show. */
  excerpt?: string;
};

export type ValidationResult = {
  /** No high-severity issues. */
  valid: boolean;
  /** True when something could not be checked deterministically. */
  needsReview: boolean;
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

/** Calendar dates the draft states, normalised to "month day". */
function extractDates(draft: string): string[] {
  return [...draft.matchAll(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"))]
    .map((match) => `${match[1].toLowerCase()} ${Number(match[2])}`);
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
    const monthName = MONTHS.split("|")[Number(iso[2]) - 1];
    return monthName ? `${monthName} ${Number(iso[3])}` : null;
  }
  const named = value.match(new RegExp(`(${MONTHS})\\s+(\\d{1,2})`, "i"));
  return named ? `${named[1].toLowerCase()} ${Number(named[2])}` : null;
}

function checkFormatting(draft: string, firstName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (draft.includes("—") || draft.includes("–")) {
    issues.push({ type: "em_dash", severity: "high", description: "Contains an em or en dash." });
  }

  const upperMeridiem = draft.match(/\b\d{1,2}(?::\d{2})?\s?(?:AM|PM|A\.M\.|P\.M\.)\b/);
  if (upperMeridiem) {
    issues.push({
      type: "uppercase_meridiem", severity: "high",
      description: 'Times must be lowercase, like "5:30 pm".',
      excerpt: upperMeridiem[0],
    });
  }

  const signature = SIGNATURE_PATTERNS.find((pattern) => pattern.test(draft));
  if (signature) {
    issues.push({
      type: "signature_present", severity: "high",
      description: "Ends with a sign-off or signature. Gmail adds that, so this one would duplicate it.",
    });
  }

  for (const phrase of BANNED_PHRASES) {
    if (draft.toLowerCase().includes(phrase)) {
      issues.push({
        type: "banned_phrase", severity: "medium",
        description: "Uses corporate boilerplate.", excerpt: phrase,
      });
    }
  }

  if (/(?:^|\n)\s*(?:\*\*|##|###)|\*\*\w/.test(draft)) {
    issues.push({ type: "markdown_formatting", severity: "high", description: "Contains markdown formatting." });
  }
  if (/(?:^|\n)\s*(?:[-*•]\s+\S|\d+\.\s+\S)/.test(draft)) {
    issues.push({
      type: "bullet_list", severity: "medium",
      description: "Contains a bulleted or numbered list. Availability belongs in a sentence.",
    });
  }
  if (EMOJI.test(draft)) {
    issues.push({ type: "emoji", severity: "medium", description: "Contains an emoji." });
  }

  const greeting = new RegExp(`^\\s*(?:hi|hey|hello)\\s+${firstName}\\b`, "i");
  if (!greeting.test(draft)) {
    issues.push({
      type: "missing_greeting", severity: "medium",
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
      type: "unsupported_price", severity: "high",
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
    const clientRaised = new Set(
      [...context.thread.digest.datesDiscussed, context.request.dateInMind ?? ""]
        .map(normalizeDateMention)
        .filter((value): value is string => value !== null),
    );
    // Unavailable dates are nameable too — the draft has to be able to rule out
    // a date Chris cannot shoot.
    for (const entry of context.availability.unavailable) {
      const normalized = normalizeDateMention(entry.label);
      if (normalized) clientRaised.add(normalized);
    }

    for (const date of extractDates(draft)) {
      if (offerable.has(date) || clientRaised.has(date)) continue;
      issues.push({
        type: "unsupported_date", severity: "high",
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
      type: "fabricated_booking_state", severity: "high",
      description: "Says the invoice or contract was sent, but nothing in the thread shows it was.",
    });
  }

  const claimsPaid = /\b(?:deposit|retainer|payment)\b[^.!?]{0,40}\b(?:received|came through|went through|confirmed)\b/i.test(draft)
    || /\byour (?:session|date) is (?:confirmed|booked|secured)\b/i.test(draft);
  if (claimsPaid && !context.thread.digest.depositPaid) {
    issues.push({
      type: "fabricated_payment", severity: "high",
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

    const covered = keywords.filter((word) => draftWords.has(word)).length / keywords.length;
    if (covered < 0.34) {
      issues.push({
        type: "unanswered_question", severity: "medium",
        description: "A question in their latest email looks unanswered.",
        excerpt: question,
      });
    }
  }
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
      type: "truncated", severity: "high",
      description: "Claude hit the output limit, so this draft is cut off. Do not send it.",
    });
  }

  issues.push(
    ...checkFormatting(trimmed, context.client.firstName),
    ...checkFacts(trimmed, context),
    ...checkQuestionsAnswered(trimmed, context),
  );

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_REASONABLE_WORDS) {
    issues.push({
      type: "too_long", severity: "low",
      description: `${wordCount} words. Chris's replies run shorter than this.`,
    });
  }

  // Anything the context itself could not verify leaves correctness open, no
  // matter how clean the string checks came out.
  const unverifiedContext = context.warnings.some((warning) => warning.severity === "high");

  return {
    valid: !issues.some((issue) => issue.severity === "high"),
    needsReview: unverifiedContext || issues.length > 0,
    issues,
  };
}
