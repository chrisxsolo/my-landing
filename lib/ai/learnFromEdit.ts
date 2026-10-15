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
// ─────────────────────────────────────────────────────────────────────────────

import { detectEdits, isFactualOnly, type DetectedEdit } from "./correctionDiff";
import { classifyRuleIntake, type RuleIntake, type WritingRule } from "./writingRules";
import type { EmailModelCaller } from "./emailModel";

export type RuleCandidate = {
  rule: string;
  intake: RuleIntake;
  /** The edits that produced it, so Chris can see why it was proposed. */
  basis: string[];
};

export type LearnResult = {
  edits: DetectedEdit[];
  candidates: RuleCandidate[];
  /** True when nothing was sent to Claude. */
  deterministicOnly: boolean;
  message: string;
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
  if (/^\s*NONE\s*$/i.test(raw.trim())) return [];
  return raw
    .split("\n")
    .filter((line) => /^\s*[-–•*]\s/.test(line))
    .map((line) => line.replace(/^\s*[-–•*]\s*/, "").trim())
    .filter((line) => line.length > 12 && line.length < 240);
}

export type LearnInput = {
  aiDraft: string;
  sentDraft: string;
  existingRules: WritingRule[];
};

/**
 * Deterministic pass only. No API call, no writes.
 *
 * This is what runs automatically after a send: it reports what changed
 * without spending anything or committing to a preference.
 */
export function analyzeEditsDeterministically(input: LearnInput): LearnResult {
  const edits = detectEdits(input.aiDraft, input.sentDraft);

  if (!edits.length) {
    return {
      edits, candidates: [], deterministicOnly: true, usage: null,
      message: "Sent exactly as drafted, with no edits.",
    };
  }
  if (isFactualOnly(edits)) {
    return {
      edits, candidates: [], deterministicOnly: true, usage: null,
      message: "Only facts changed in this email, so there is no writing preference to learn.",
    };
  }
  return {
    edits, candidates: [], deterministicOnly: true, usage: null,
    message: `${edits.filter((edit) => edit.ruleCandidate).length} stylistic change${edits.filter((e) => e.ruleCandidate).length === 1 ? "" : "s"} found. Use Learn from edit to turn them into rules.`,
  };
}

/**
 * Full pass: deterministic classification, then one Claude call to phrase the
 * stylistic edits as rules. Runs only when Chris explicitly asks.
 */
export async function learnFromEdit(
  input: LearnInput,
  call: EmailModelCaller,
): Promise<LearnResult> {
  const base = analyzeEditsDeterministically(input);

  // Nothing stylistic to phrase, so there is nothing worth paying for.
  if (!base.edits.some((edit) => edit.ruleCandidate)) return base;

  const result = await call({
    system: {
      stable: PHRASING_SYSTEM,
      volatile: "",
    },
    userPrompt: `These are the changes Chris made to an AI draft before sending it:

${describeEdits(base.edits)}

Write the durable writing rules these changes support.`,
    maxTokens: 400,
  });

  const candidates: RuleCandidate[] = parseRules(result.text).map((rule) => ({
    rule,
    intake: classifyRuleIntake(rule, input.existingRules),
    basis: base.edits.filter((edit) => edit.ruleCandidate).map((edit) => edit.kind),
  }));

  const fresh = candidates.filter((candidate) => candidate.intake.verdict === "new").length;
  const duplicates = candidates.filter((candidate) => candidate.intake.verdict === "duplicate").length;
  const conflicts = candidates.filter((candidate) => candidate.intake.verdict === "conflict").length;

  const parts: string[] = [];
  if (fresh) parts.push(`${fresh} new rule${fresh === 1 ? "" : "s"} to approve`);
  if (duplicates) parts.push(`${duplicates} already saved`);
  if (conflicts) parts.push(`${conflicts} conflicting with an existing rule`);

  return {
    edits: base.edits,
    candidates,
    deterministicOnly: false,
    message: parts.length ? parts.join(", ") : "No general rule came out of these edits.",
    usage: {
      model: result.model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      duration_ms: result.durationMs,
    },
  };
}
