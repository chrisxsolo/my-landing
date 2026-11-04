// ─────────────────────────────────────────────────────────────────────────────
// Turning Chris's edits into durable preferences.
//
// Two gates stand between an edit and a rule that reaches a prompt.
//
// First, deterministic classification (lib/ai/correctionDiff.ts). A changed
// price, date, time or client name is factual and stops here — it can never
// become a style rule. If every edit is factual, this costs nothing and makes
// no API call at all.
//
// Second, approval. Style edits become *candidates* with status `pending`.
// Nothing influences a draft until Chris approves it, and a candidate that
// contradicts an approved rule is reported as a conflict for him to settle
// rather than stacked on top of it.
//
// The deterministic result is the source of truth for whether anything
// changed. The model call that phrases rules can fail; when it does, the
// result still carries the edits and says the phrasing failed, so the panel
// never reports "no edits" or a drafting error for a learning problem.
// ─────────────────────────────────────────────────────────────────────────────

import { detectEdits, isFactualOnly, type DetectedEdit } from "./correctionDiff";
import { classifyRuleIntake, type RuleIntake, type WritingRule } from "./writingRules";
import { classifyModelError, friendlyModelError, type EmailModelCaller } from "./emailModel";

export type RuleCandidate = {
  rule: string;
  intake: RuleIntake;
  /** The edits that produced it, so Chris can see why it was proposed. */
  basis: string[];
};

/**
 * Where the flow got to. Deterministic outcomes first, then what happened to
 * the optional model call and the write that follows it.
 */
export type LearnOutcome =
  /** No meaningful difference after whitespace normalisation. */
  | "unchanged"
  /** Only prices, dates, times or names changed: corrections, never rules. */
  | "factual_only"
  /** Stylistic edits exist; no model was asked (auto mode, or not yet). */
  | "style_candidates"
  /** Claude phrased rules and new ones were stored as pending. */
  | "rules_pending"
  /** Claude answered but no new general rule came out (NONE, or all duplicates/conflicts). */
  | "no_general_rule"
  /** Edits were found but Claude could not phrase them. Retryable. */
  | "phrasing_failed"
  /** Rules were phrased but could not all be stored. Retryable. */
  | "persist_failed";

export type LearnErrorCode =
  | "not_configured" | "auth" | "rate_limit" | "overloaded" | "timeout" | "credit" | "invalid_request"
  | "empty_output" | "rules_read" | "rules_write" | "unknown";

export type LearnFailure = { code: LearnErrorCode; message: string };

export type LearnResult = {
  outcome: LearnOutcome;
  edits: DetectedEdit[];
  candidates: RuleCandidate[];
  /** True when nothing was sent to Claude. */
  deterministicOnly: boolean;
  message: string;
  failure: LearnFailure | null;
  usage: { input_tokens: number; output_tokens: number; model: string; duration_ms: number } | null;
};

const PHRASING_SYSTEM = `You turn one photographer's edits to an email draft into durable writing rules.

A rule must be:
- One sentence, phrased as an instruction: "Keep...", "Open with...", "Never...".
- About HOW to write, never about a specific client, date, price, time, or place.
- General enough to apply to the next client, specific enough to act on.

Reject anything that only makes sense for one email. If an edit swapped a date, a price, a time, or a name, that is a correction to that email and NOT a rule, so leave it out.

Output one rule per line, each starting with "- ". Output nothing else. If no edit supports a general rule, output exactly: NONE`;

/** Compact description of the edits. Full drafts are never sent. */
function describeEdits(edits: DetectedEdit[]): string {
  return edits
    .filter((edit) => edit.ruleCandidate)
    .map((edit) => {
      const parts = [`${edit.kind}: ${edit.description}`];
      if (edit.before) parts.push(`  removed: "${edit.before.slice(0, 200)}"`);
      if (edit.after) parts.push(`  added: "${edit.after.slice(0, 200)}"`);
      return parts.join("\n");
    })
    .join("\n");
}

function parseRules(raw: string): string[] {
  return raw
    .split("\n")
    .filter((line) => /^\s*[-–•*]\s/.test(line))
    .map((line) => line.replace(/^\s*[-–•*]\s*/, "").trim())
    .filter((line) => line.length > 12 && line.length < 240);
}

const saidNone = (raw: string): boolean => /^\s*NONE\s*\.?\s*$/i.test(raw);

export type LearnInput = {
  aiDraft: string;
  sentDraft: string;
  existingRules: WritingRule[];
};

export const styleCandidates = (edits: DetectedEdit[]): DetectedEdit[] => edits.filter((edit) => edit.ruleCandidate);

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The message for a model or store failure after the diff succeeded. */
export function phrasingFailedMessage(edits: DetectedEdit[], detail: string): string {
  return `I found ${plural(edits.length, "change")}, but couldn't turn the style changes into rules. ${detail}`;
}

/**
 * Deterministic pass only. No API call, no writes.
 *
 * This is what runs automatically after a send: it reports what changed
 * without spending anything or committing to a preference.
 */
export function analyzeEditsDeterministically(input: LearnInput): LearnResult {
  const edits = detectEdits(input.aiDraft, input.sentDraft);
  const base = { edits, candidates: [], deterministicOnly: true, usage: null, failure: null };

  if (!edits.length) {
    return { ...base, outcome: "unchanged", message: "Sent exactly as drafted, with no edits." };
  }
  if (isFactualOnly(edits)) {
    return {
      ...base, outcome: "factual_only",
      message: "Only facts changed in this email, so there is no writing preference to learn.",
    };
  }
  return {
    ...base, outcome: "style_candidates",
    message: `${plural(styleCandidates(edits).length, "stylistic change")} found. Use Learn from edit to turn them into rules.`,
  };
}

function summariseCandidates(candidates: RuleCandidate[]): string {
  const count = (verdict: RuleIntake["verdict"]) => candidates.filter((c) => c.intake.verdict === verdict).length;
  const fresh = count("new");
  const duplicates = count("duplicate");
  const conflicts = count("conflict");

  const parts: string[] = [];
  if (fresh) parts.push(`${plural(fresh, "new rule")} to approve`);
  if (duplicates) parts.push(`${duplicates} already saved`);
  if (conflicts) parts.push(`${conflicts} conflicting with an existing rule`);
  return parts.length ? parts.join(", ") : "No general rule came out of these edits.";
}

/**
 * Full pass: deterministic classification, then one Claude call to phrase the
 * stylistic edits as rules. Runs only when Chris explicitly asks.
 *
 * Never throws for a model problem. The edits were found before the call was
 * made, and they stay in the result with `outcome: "phrasing_failed"`.
 */
export async function learnFromEdit(
  input: LearnInput,
  call: EmailModelCaller,
): Promise<LearnResult> {
  const base = analyzeEditsDeterministically(input);

  // Nothing stylistic to phrase, so there is nothing worth paying for.
  if (base.outcome !== "style_candidates") return base;

  let text: string;
  let usage: LearnResult["usage"];
  try {
    const result = await call({
      system: { stable: PHRASING_SYSTEM, volatile: "" },
      userPrompt: `These are the changes Chris made to an AI draft before sending it:

${describeEdits(base.edits)}

Write the durable writing rules these changes support.`,
      maxTokens: 400,
    });
    text = result.text;
    usage = {
      model: result.model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      duration_ms: result.durationMs,
    };
  } catch (err) {
    const code = classifyModelError(err);
    return {
      ...base, deterministicOnly: false, outcome: "phrasing_failed",
      failure: { code, message: friendlyModelError(err, "learn") },
      message: phrasingFailedMessage(base.edits, friendlyModelError(err, "learn")),
    };
  }

  if (saidNone(text)) {
    return { ...base, deterministicOnly: false, usage, outcome: "no_general_rule", message: "No general rule came out of these edits." };
  }

  const candidates: RuleCandidate[] = parseRules(text).map((rule) => ({
    rule,
    intake: classifyRuleIntake(rule, input.existingRules),
    basis: styleCandidates(base.edits).map((edit) => edit.kind),
  }));

  // Empty or off-format output is a failure of the phrasing step, not proof
  // that the edits carried no preference.
  if (!candidates.length) {
    const detail = "Claude's reply had no rules in it. Your edits are still here; try again.";
    return {
      ...base, deterministicOnly: false, usage, outcome: "phrasing_failed",
      failure: { code: "empty_output", message: detail },
      message: phrasingFailedMessage(base.edits, detail),
    };
  }

  return {
    ...base,
    candidates,
    deterministicOnly: false,
    usage,
    outcome: candidates.some((c) => c.intake.verdict === "new") ? "rules_pending" : "no_general_rule",
    message: summariseCandidates(candidates),
  };
}
