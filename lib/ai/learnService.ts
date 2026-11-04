// ─────────────────────────────────────────────────────────────────────────────
// The "Learn from reply" review flow, in stages, with its dependencies
// injected so the route stays thin and the stages can be tested without
// Supabase or the Anthropic SDK.
//
//   1. load existing rules (needed to classify candidates as new/duplicate)
//   2. compute deterministic edits
//   3. no style candidates → return the deterministic outcome, no model call
//   4. ask Claude to phrase rules (one call)
//   5. persist only NEW candidates as pending
//   6. return edits + rule outcome together
//
// Every failure after step 2 keeps the edits in the result. The route's
// response is built from this result, so a client never has to infer state
// from English text.
// ─────────────────────────────────────────────────────────────────────────────

import {
  analyzeEditsDeterministically, learnFromEdit, phrasingFailedMessage, styleCandidates,
  type LearnResult,
} from "./learnFromEdit";
import type { WritingRule, RuleCategory, RuleStatus } from "./writingRules";
import type { EmailModelCaller } from "./emailModel";

export type LearnDeps = {
  fetchRules: () => Promise<WritingRule[]>;
  insertRule: (input: { rule: string; category: RuleCategory; status: RuleStatus; source: string }) => Promise<WritingRule | null>;
  /** Null when no model is configured. The deterministic stages still run. */
  call: EmailModelCaller | null;
};

export type PendingRule = { id: string; rule: string };

export type LearnReviewResult = LearnResult & {
  /** Rows actually written. Empty unless the insert succeeded. */
  pending: PendingRule[];
  apiCalls: number;
};

export const LEARN_RULE_SOURCE = "learn-from-edit";

const NOT_CONFIGURED = "The Claude API key is not configured, so the style changes could not be turned into rules.";
const RULES_READ_FAILED = "Your existing rules could not be read, so nothing was proposed. Your edits are still here; try again.";

type ReviewInput = { aiDraft: string; sentDraft: string };

function withoutModel(result: LearnResult): LearnReviewResult {
  return { ...result, pending: [], apiCalls: 0 };
}

async function persistNewRules(result: LearnResult, insertRule: LearnDeps["insertRule"]): Promise<LearnReviewResult> {
  const fresh = result.candidates.filter((candidate) => candidate.intake.verdict === "new");
  const written = await Promise.all(
    fresh.map(async (candidate) => {
      const row = await insertRule({ rule: candidate.rule, category: "style", status: "pending", source: LEARN_RULE_SOURCE });
      return row ? { id: row.id, rule: row.rule } : null;
    }),
  );
  const pending = written.filter((row): row is PendingRule => row !== null);

  if (pending.length < fresh.length) {
    const detail = pending.length
      ? `Saved ${pending.length} of ${fresh.length} rules; the rest could not be stored. Try again for the others.`
      : "The rules could not be saved. Your edits are still here; try again.";
    return {
      ...result, pending, apiCalls: 1, outcome: "persist_failed",
      failure: { code: "rules_write", message: detail },
      message: phrasingFailedMessage(result.edits, detail),
    };
  }
  return { ...result, pending, apiCalls: 1 };
}

/** Runs the review flow. Resolves for every outcome; throws only on a bug. */
export async function runLearnReview(input: ReviewInput, deps: LearnDeps): Promise<LearnReviewResult> {
  const deterministic = analyzeEditsDeterministically({ ...input, existingRules: [] });
  if (deterministic.outcome !== "style_candidates") return withoutModel(deterministic);

  let existingRules: WritingRule[];
  try {
    existingRules = await deps.fetchRules();
  } catch {
    return withoutModel({
      ...deterministic, outcome: "phrasing_failed",
      failure: { code: "rules_read", message: RULES_READ_FAILED },
      message: phrasingFailedMessage(deterministic.edits, RULES_READ_FAILED),
    });
  }

  if (!deps.call) {
    return withoutModel({
      ...deterministic, outcome: "phrasing_failed",
      failure: { code: "not_configured", message: NOT_CONFIGURED },
      message: phrasingFailedMessage(deterministic.edits, NOT_CONFIGURED),
    });
  }

  const phrased = await learnFromEdit({ ...input, existingRules }, deps.call);
  if (phrased.outcome !== "rules_pending") return { ...phrased, pending: [], apiCalls: phrased.deterministicOnly ? 0 : 1 };
  return persistNewRules(phrased, deps.insertRule);
}

/** Safe-to-log summary: kinds and sizes, never text. */
export function describeForLog(result: LearnReviewResult, input: ReviewInput) {
  return {
    outcome: result.outcome,
    code: result.failure?.code ?? null,
    edits: result.edits.length,
    styleEdits: styleCandidates(result.edits).length,
    editKinds: result.edits.map((edit) => edit.kind),
    aiDraftChars: input.aiDraft.length,
    sentChars: input.sentDraft.length,
    pending: result.pending.length,
  };
}
