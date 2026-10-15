// ─────────────────────────────────────────────────────────────────────────────
// Did Chris send the draft, or rewrite it?
//
// The assistant could already say what a draft cost and what the validator
// thought of it. Neither answers the only question that decides whether this
// feature is worth having. This module turns one send into one row of numbers.
//
// Two deliberate limits.
//
// It stores no email content. Word counts, a similarity ratio, and the kinds of
// edit found. The draft is already in ai_drafts and the sent mail is already in
// Gmail; a third copy inside a metrics table would be client correspondence
// kept somewhere nothing reads it.
//
// It never writes a writing rule. An edit is evidence, not an instruction:
// some edits are specific to one client, some reflect news that arrived after
// generation, some are taste. Rules still come only from Chris approving them
// (lib/ai/writingRules.ts). This measures; it does not learn.
// ─────────────────────────────────────────────────────────────────────────────

import { detectEdits, type DetectedEdit } from "./correctionDiff";

export const DRAFT_OUTCOMES_TABLE = "ai_draft_outcomes";

export type DraftOutcome = {
  inquiryId: number | null;
  aiWords: number;
  sentWords: number;
  /** 1.0 when the email went out exactly as drafted. */
  similarity: number;
  sentUnchanged: boolean;
  factualEdits: number;
  stylisticEdits: number;
  editKinds: string[];
  wasRegenerated: boolean;
};

const wordsOf = (text: string): string[] => text.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Word-overlap ratio, as a bag of words.
 *
 * Bag-of-words rather than a character diff on purpose: moving a sentence is
 * not the same kind of edit as replacing one, and a character-level ratio
 * scores a reordering as heavily as a rewrite. This answers "how much of the
 * draft survived", which is the question.
 */
export function similarityOf(aiDraft: string, sentDraft: string): number {
  const ai = wordsOf(aiDraft);
  const sent = wordsOf(sentDraft);
  if (!ai.length && !sent.length) return 1;
  if (!ai.length || !sent.length) return 0;

  const remaining = new Map<string, number>();
  for (const word of sent) remaining.set(word, (remaining.get(word) ?? 0) + 1);

  let kept = 0;
  for (const word of ai) {
    const count = remaining.get(word) ?? 0;
    if (count > 0) {
      kept++;
      remaining.set(word, count - 1);
    }
  }
  // Denominated by the longer side, so padding a draft out cannot score as
  // high as sending it untouched.
  return Number((kept / Math.max(ai.length, sent.length)).toFixed(3));
}

export type BuildOutcomeInput = {
  inquiryId: number | null;
  aiDraft: string;
  sentDraft: string;
  wasRegenerated?: boolean;
  /** Injectable so the measurement can be tested without the differ. */
  edits?: DetectedEdit[];
};

export function buildDraftOutcome(input: BuildOutcomeInput): DraftOutcome {
  const ai = input.aiDraft.trim();
  const sent = input.sentDraft.trim();
  const edits = input.edits ?? detectEdits(ai, sent);

  return {
    inquiryId: input.inquiryId,
    aiWords: wordsOf(ai).length,
    sentWords: wordsOf(sent).length,
    similarity: similarityOf(ai, sent),
    // Compared after trimming, so a trailing newline is not an edit.
    sentUnchanged: ai === sent,
    factualEdits: edits.filter((edit) => edit.category === "factual").length,
    stylisticEdits: edits.filter((edit) => edit.category !== "factual").length,
    editKinds: [...new Set(edits.map((edit) => edit.kind))],
    wasRegenerated: Boolean(input.wasRegenerated),
  };
}
