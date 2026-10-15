// ─────────────────────────────────────────────────────────────────────────────
// The email assistant's operations. One Claude call each, no exceptions.
//
// Every operation shares the same shape: assemble context without the model,
// build a prompt, make exactly one request, validate deterministically, record
// usage. Nothing here chains a second call — the old pipeline's second call
// existed only to rewrite the rules file, and it corrupted it.
// ─────────────────────────────────────────────────────────────────────────────

import { buildEmailContext, type BuildEmailContextInput, type EmailContext } from "./buildEmailContext";
import { buildSystemPrompt, buildGenerateUserPrompt } from "./emailPrompt";
import { validateEmailDraft, type ValidationResult } from "./validateEmailDraft";
import { selectPromptRules, type WritingRule } from "./writingRules";
import { PERMANENT_RULES } from "./soloxsnapsWritingProfile";
import type { EmailModelCaller, EmailCallResult } from "./emailModel";
import type { EmailOperation, UsageRecord } from "./aiUsage";

/** Strips anything the model wrapped around the email body. */
export function cleanDraft(raw: string): string {
  let draft = raw.trim();

  // Quoted-header block the model sometimes copies from the thread.
  draft = draft.replace(
    /^(?:[^\n]*<[^\n@>]+@[^\n>]+>[^\n]*\n[^\n]+at\s+\d+:\d+[^\n]*\n(?:to\s+[^\n]+\n)?[\s\n]*)/,
    "",
  );
  // Markdown fence, or the whole body wrapped in quotes.
  draft = draft.replace(/^```(?:\w+)?\n([\s\S]*?)\n```$/, "$1");
  draft = draft.replace(/^"([\s\S]*)"$/, "$1");
  // A "Subject:" line the output contract forbids but the model occasionally adds.
  draft = draft.replace(/^subject:.*\n+/i, "");

  return draft.trim();
}

/**
 * Removes a trailing sign-off.
 *
 * Still worth doing after the prompt and the validator both forbid one:
 * stripping it silently is better than handing Chris a draft he has to edit,
 * and the validator still reports it so the miss stays visible.
 */
export function stripSignoff(text: string): string {
  return text
    .replace(/\n+\s*(?:best|thanks|thank you|cheers|warm(?:est)? regards|regards|sincerely|talk soon)[,.!]?\s*\n+\s*chris\s*$/i, "")
    .replace(/\n+[-–—]?\s*chris\s*$/i, "")
    .trimEnd();
}

/**
 * Drops the period from the end of each paragraph.
 *
 * Chris does not put one there. The rule was in the permanent profile from the
 * start but nothing enforced it, and a live eval showed the model adding them
 * freely ("I'd love to capture this for you.").
 *
 * Stripped only after a lowercase letter, digit, or closing bracket, so a
 * genuine abbreviation at the end of a paragraph ("...based in the U.S.") keeps
 * its period rather than being mangled. Question and exclamation marks are
 * left alone — those are his.
 */
export function stripParagraphPeriods(text: string): string {
  return text
    .split(/\n/)
    .map((line) => line.replace(/([a-z0-9)\]])\.$/, "$1"))
    .join("\n");
}

export type OperationResult = {
  draft: string;
  validation: ValidationResult;
  context: EmailContext;
  usage: UsageRecord;
  estimatedCostUsd: number;
};

export type GenerateInput = BuildEmailContextInput & {
  latestClientMessage: string | null;
  threadText: string | null;
  chrisInstruction?: string | null;
  rules: WritingRule[];
  isRegeneration?: boolean;
};

function toUsageRecord(
  operation: EmailOperation,
  result: EmailCallResult,
  isRegeneration = false,
): UsageRecord {
  return {
    operation,
    model: result.model,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    cache_creation_input_tokens: result.usage.cache_creation_input_tokens,
    cache_read_input_tokens: result.usage.cache_read_input_tokens,
    duration_ms: result.durationMs,
    success: true,
    is_regeneration: isRegeneration,
  };
}

/** Fresh draft, or a regeneration of one. */
export async function generateDraft(
  input: GenerateInput,
  call: EmailModelCaller,
): Promise<OperationResult> {
  const context = buildEmailContext(input);
  const system = buildSystemPrompt(context, selectPromptRules(input.rules));
  const userPrompt = buildGenerateUserPrompt({
    context,
    latestClientMessage: input.latestClientMessage,
    threadText: input.threadText,
    chrisInstruction: input.chrisInstruction,
  });

  const result = await call({ system, userPrompt });
  const draft = stripParagraphPeriods(stripSignoff(cleanDraft(result.text)));

  return {
    draft,
    validation: validateEmailDraft(draft, context, result.stopReason),
    context,
    usage: toUsageRecord("generate", result, input.isRegeneration),
    estimatedCostUsd: 0,
  };
}

/**
 * System prompt for a surgical edit.
 *
 * Carries the hard rules and the verified facts but omits the examples: the
 * draft being edited already has the right shape, and a set of complete
 * example emails invites a rewrite when one sentence was the ask.
 */
function buildEditSystem(context: EmailContext, rules: WritingRule[]) {
  return buildSystemPrompt(context, selectPromptRules(rules), { includeExamples: false });
}

export type EditInput = BuildEmailContextInput & {
  currentDraft: string;
  rules: WritingRule[];
  threadText?: string | null;
};

export type RefineInput = EditInput & { feedback: string };

/** Applies one instruction from Chris and changes nothing else. */
export async function refineDraft(
  input: RefineInput,
  call: EmailModelCaller,
): Promise<OperationResult> {
  const context = buildEmailContext(input);

  const userPrompt = `Here is the current draft:

<draft>
${input.currentDraft}
</draft>

<chris_instruction>
${input.feedback.trim()}
</chris_instruction>

Apply that instruction and change nothing else. Treat every other sentence as correct and leave it exactly as it is. Do not improve the wording, do not reorder anything, do not add or remove information the instruction did not ask about.

Any date, time, or price you keep or introduce must still come from the verified facts above.

Output the revised email body only.`;

  const result = await call({ system: buildEditSystem(context, input.rules), userPrompt });
  const draft = stripParagraphPeriods(stripSignoff(cleanDraft(result.text)));

  return {
    draft,
    validation: validateEmailDraft(draft, context, result.stopReason),
    context,
    usage: toUsageRecord("refine", result),
    estimatedCostUsd: 0,
  };
}

export type PolishInput = EditInput & { rawDraft: string };

/** Turns dictation or bullet notes into a proper email in Chris's voice. */
export async function polishDraft(
  input: PolishInput,
  call: EmailModelCaller,
): Promise<OperationResult> {
  const context = buildEmailContext(input);
  const system = buildSystemPrompt(context, selectPromptRules(input.rules));

  const userPrompt = `Chris wrote this roughly, often by voice dictation. Turn it into a finished email in his voice.

<chris_instruction>
Keep every piece of information he put in. Fix typos, turn fragments or bullets into short paragraphs, and make it read like him.

This may contain speech-to-text errors: words that sound like the intended word. Use the thread to correct them, and trust what the client actually wrote over what the dictation says. If the dictation says "Palisades of Fine Arts" and the thread says "Palace of Fine Arts", it is the Palace.

Do not add information he did not write. Do not add a price, date, or time that is not already in his draft or in the verified facts.
</chris_instruction>
${input.threadText?.trim() ? `\n<thread>\nQuoted client text, for correcting dictation errors only.\n${input.threadText.trim()}\n</thread>\n` : ""}
<rough_draft>
${input.rawDraft}
</rough_draft>

Output the polished email body only.`;

  const result = await call({ system, userPrompt });
  const draft = stripParagraphPeriods(stripSignoff(cleanDraft(result.text)));

  return {
    draft,
    validation: validateEmailDraft(draft, context, result.stopReason),
    context,
    usage: toUsageRecord("polish", result),
    estimatedCostUsd: 0,
  };
}

/** Cuts length without losing information. */
export async function shortenDraft(
  input: EditInput,
  call: EmailModelCaller,
): Promise<OperationResult> {
  const context = buildEmailContext(input);

  const userPrompt = `Here is the current draft:

<draft>
${input.currentDraft}
</draft>

Make it shorter. Cut filler, hedging, and anything said twice. Keep every fact: every date, time, price, location, question, and the next step all survive. If a sentence carries information, tighten it rather than deleting it.

Do not introduce any new date, time, or price.

Output the shorter email body only.`;

  const result = await call({ system: buildEditSystem(context, input.rules), userPrompt });
  const draft = stripParagraphPeriods(stripSignoff(cleanDraft(result.text)));

  return {
    draft,
    validation: validateEmailDraft(draft, context, result.stopReason),
    context,
    usage: toUsageRecord("shorten", result),
    estimatedCostUsd: 0,
  };
}

/** Pulls the wording back toward Chris's voice, facts untouched. */
export async function naturalizeDraft(
  input: EditInput,
  call: EmailModelCaller,
): Promise<OperationResult> {
  const context = buildEmailContext(input);
  // Examples earn their place here: this operation is entirely about voice.
  const system = buildSystemPrompt(context, selectPromptRules(input.rules));

  const userPrompt = `Here is the current draft:

<draft>
${input.currentDraft}
</draft>

Rewrite it so it sounds like Chris. Match the rhythm, warmth, and sentence length of the approved examples above. Strip anything that reads as corporate or stiff.

Every fact stays exactly as it is: the same dates, the same times, the same prices, the same questions, the same next step. This is a voice change only.

These rules still hold:
${PERMANENT_RULES.map((rule) => `- ${rule}`).join("\n")}

Output the rewritten email body only.`;

  const result = await call({ system, userPrompt });
  const draft = stripParagraphPeriods(stripSignoff(cleanDraft(result.text)));

  return {
    draft,
    validation: validateEmailDraft(draft, context, result.stopReason),
    context,
    usage: toUsageRecord("naturalize", result),
    estimatedCostUsd: 0,
  };
}
