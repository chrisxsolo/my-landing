// ─────────────────────────────────────────────────────────────────────────────
// Classifying what Chris changed in a draft.
//
// The old "Learn from Reply" sent both versions to a model told that every
// change, however small, was intentional and must become a rule. That is how
// 'Use "Kaitlyn" not "Caitlin"' and 'Increase the suggested start time from
// 6:15 pm to 6:30 pm' ended up as permanent writing rules.
//
// This classifies edits deterministically first. A changed name, date, time or
// price is FACTUAL — specific to one client, never a style rule. Only genuinely
// stylistic changes become rule candidates, and even then Chris approves them
// before they reach a prompt.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuleCategory } from "./writingRules";

export type EditKind =
  | "price_changed"
  | "date_changed"
  | "time_changed"
  | "name_changed"
  | "signature_removed"
  | "shortened"
  | "lengthened"
  | "closing_changed"
  | "phrase_removed"
  | "phrase_added"
  | "formatting_changed"
  | "rewritten";

export type DetectedEdit = {
  kind: EditKind;
  category: RuleCategory;
  description: string;
  before?: string;
  after?: string;
  /** True when this edit is worth offering as a durable preference. */
  ruleCandidate: boolean;
};

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";

function prices(text: string): string[] {
  return [...text.matchAll(/\$\s?[\d,]+(?:\.\d{2})?/g)].map((m) => m[0].replace(/\s/g, ""));
}
function times(text: string): string[] {
  return [...text.matchAll(/\b\d{1,2}:\d{2}\s?(?:am|pm)\b/gi)].map((m) => m[0].toLowerCase());
}
function dates(text: string): string[] {
  return [...text.matchAll(new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "gi"))]
    .map((m) => m[0].toLowerCase());
}
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Set difference preserving order of the source. */
function removed(before: string[], after: string[]): string[] {
  const afterSet = new Set(after);
  return before.filter((item) => !afterSet.has(item));
}

const SIGNATURE = /\n\s*(?:best|thanks|cheers|regards|sincerely)[,.!]?\s*\n+\s*chris\b|\n\s*[-–—]\s*chris\s*$/i;

const LENGTH_CHANGE_RATIO = 0.15;

/**
 * Compares the AI draft against what Chris actually sent.
 *
 * Factual swaps are detected first and reported as factual, so a changed date
 * can never be mistaken for a preference about dates.
 */
export function detectEdits(aiDraft: string, sentDraft: string): DetectedEdit[] {
  const edits: DetectedEdit[] = [];
  const before = aiDraft.trim();
  const after = sentDraft.trim();

  if (normalizeWhitespace(before) === normalizeWhitespace(after)) return [];

  // ── Factual swaps: client-specific, never generalised ─────────────────────
  const factualChecks: [EditKind, string[], string[], string][] = [
    ["price_changed", prices(before), prices(after), "price"],
    ["date_changed", dates(before), dates(after), "date"],
    ["time_changed", times(before), times(after), "time"],
  ];

  for (const [kind, beforeValues, afterValues, noun] of factualChecks) {
    const dropped = removed(beforeValues, afterValues);
    const added = removed(afterValues, beforeValues);
    if (!dropped.length && !added.length) continue;
    edits.push({
      kind,
      category: "factual",
      description: `The ${noun} changed${dropped.length ? ` from ${dropped.join(", ")}` : ""}${added.length ? ` to ${added.join(", ")}` : ""}. That is a correction to this one email, not a writing preference.`,
      before: dropped.join(", ") || undefined,
      after: added.join(", ") || undefined,
      ruleCandidate: false,
    });
  }

  const beforeGreeting = before.match(/^\s*(?:hi|hey|hello)\s+([A-Z][a-z'-]+)/i);
  const afterGreeting = after.match(/^\s*(?:hi|hey|hello)\s+([A-Z][a-z'-]+)/i);
  if (beforeGreeting && afterGreeting && beforeGreeting[1] !== afterGreeting[1]) {
    edits.push({
      kind: "name_changed",
      category: "factual",
      description: `The client's name was corrected from "${beforeGreeting[1]}" to "${afterGreeting[1]}". Specific to this client.`,
      before: beforeGreeting[1],
      after: afterGreeting[1],
      ruleCandidate: false,
    });
  }

  // ── Stylistic changes: these are the rule candidates ─────────────────────
  if (SIGNATURE.test(before) && !SIGNATURE.test(after)) {
    edits.push({
      kind: "signature_removed",
      category: "style",
      description: "A sign-off was removed. This is already a permanent rule, so no new rule is needed.",
      ruleCandidate: false,
    });
  }

  const beforeWords = words(before);
  const afterWords = words(after);
  const delta = (afterWords - beforeWords) / Math.max(beforeWords, 1);

  if (delta <= -LENGTH_CHANGE_RATIO) {
    edits.push({
      kind: "shortened",
      category: "style",
      description: `Cut from ${beforeWords} to ${afterWords} words.`,
      ruleCandidate: true,
    });
  } else if (delta >= LENGTH_CHANGE_RATIO) {
    edits.push({
      kind: "lengthened",
      category: "style",
      description: `Expanded from ${beforeWords} to ${afterWords} words.`,
      ruleCandidate: true,
    });
  }

  // A closing that changed only because a date or price inside it changed is
  // the factual edit already reported above, not a preference about closings.
  const beforeClosing = sentences(before).at(-1);
  const afterClosing = sentences(after).at(-1);
  if (
    beforeClosing && afterClosing &&
    beforeClosing !== afterClosing &&
    !hasOnlyFactualDifference(beforeClosing, [afterClosing])
  ) {
    edits.push({
      kind: "closing_changed",
      category: "style",
      description: "The closing line changed.",
      before: beforeClosing,
      after: afterClosing,
      ruleCandidate: true,
    });
  }

  // Whole sentences dropped or added, ignoring ones that only differ by a
  // factual swap already reported above.
  const beforeSentences = sentences(before);
  const afterSentences = sentences(after);
  const droppedSentences = removed(beforeSentences, afterSentences)
    .filter((sentence) => sentence !== beforeClosing && !hasOnlyFactualDifference(sentence, afterSentences));
  const addedSentences = removed(afterSentences, beforeSentences)
    .filter((sentence) => sentence !== afterClosing && !hasOnlyFactualDifference(sentence, beforeSentences));

  for (const sentence of droppedSentences.slice(0, 3)) {
    edits.push({
      kind: "phrase_removed", category: "style",
      description: "A sentence was cut.", before: sentence, ruleCandidate: true,
    });
  }
  for (const sentence of addedSentences.slice(0, 3)) {
    edits.push({
      kind: "phrase_added", category: "style",
      description: "A sentence was added.", after: sentence, ruleCandidate: true,
    });
  }

  const beforeBullets = /(?:^|\n)\s*[-*•]\s+\S/.test(before);
  const afterBullets = /(?:^|\n)\s*[-*•]\s+\S/.test(after);
  if (beforeBullets !== afterBullets) {
    edits.push({
      kind: "formatting_changed", category: "style",
      description: afterBullets
        ? "A bulleted list was introduced."
        : "A bulleted list was converted to prose.",
      ruleCandidate: true,
    });
  }

  if (!edits.length) {
    edits.push({
      kind: "rewritten", category: "style",
      description: "The wording changed without a change in length, structure, or any fact.",
      ruleCandidate: true,
    });
  }
  return edits;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Whether a sentence has a near-match in the other version, differing only in
 * numbers or dates. Keeps "I'm available October 26th" → "I'm available
 * October 28th" from being reported as a cut sentence plus an added sentence.
 */
function hasOnlyFactualDifference(sentence: string, others: string[]): boolean {
  const skeleton = (text: string) =>
    text.toLowerCase().replace(/[\d$:]+|(?:st|nd|rd|th)\b/g, "#").replace(/\s+/g, " ").trim();
  const target = skeleton(sentence);
  return others.some((other) => skeleton(other) === target);
}

/** True when the edit set contains nothing worth proposing as a rule. */
export function isFactualOnly(edits: DetectedEdit[]): boolean {
  return edits.length > 0 && edits.every((edit) => !edit.ruleCandidate);
}
