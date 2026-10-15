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
import { PERMANENT_RULES, PHRASING_CORRECTIONS } from "./soloxsnapsWritingProfile";
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
  threadText: string | null;
  chrisInstruction?: string | null;
  rules: WritingRule[];
  isRegeneration?: boolean;
  /**
   * The draft being replaced, on a regeneration.
   *
   * Without it the instruction "write a genuinely different email" was
   * unactionable: the model had nothing to be different FROM, so a second
   * attempt could reproduce the first almost verbatim and bill for it.
   */
  previousDraft?: string | null;
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

/**
 * The second-attempt instruction.
 *
 * Three things the old version got wrong. It never showed the model the draft
 * it was replacing. It told the model to change the greeting purely for
 * variety, which produced a worse opening on a draft whose opening was fine.
 * And it asserted "shorter is usually the thing he wanted", which is a guess —
 * Chris's real replies run longer than the old prompt assumed, so a
 * regeneration that cut further was often moving away from what he would send.
 *
 * Feedback outranks everything: if he said what was wrong, that is the brief,
 * and "be different" stops being the instruction at all.
 */
function regenerationBlock(
  previousDraft: string | null | undefined,
  feedback: string | null | undefined,
): string {
  const parts: string[] = [];
  const previous = previousDraft?.trim();

  if (previous) {
    parts.push(`Chris did not send this draft:\n\n<previous_draft>\n${previous}\n</previous_draft>`);
  } else {
    parts.push("This is a second attempt: Chris did not want the first draft, which is not available to show you.");
  }

  if (feedback?.trim()) {
    // Already carried in the <chris_instruction> block above; named again here
    // so the second attempt is aimed at his complaint rather than at variety.
    parts.push("He said what he wanted changed, in the instruction above. That is the brief for this attempt: fix what he named and leave what he did not name alone.");
  } else {
    parts.push(
      previous
        ? "He did not say what was wrong. Write a genuinely different email: a different structure and different wording, reaching the same verified facts. Do not simply trim the previous one, and do not change the opening merely to be different if the opening was right for this stage. Length should still follow what they asked, not a target."
        : "Write a different email from whatever came before: a different structure and different wording, reaching the same verified facts.",
    );
  }

  parts.push("Every date, time, price, and booking claim must still come from the verified facts.");
  return parts.join("\n\n");
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
    latestClientMessage: input.latestClientMessage ?? null,
    threadText: input.threadText,
    chrisInstruction: input.chrisInstruction,
  });

  const result = await call({
    system,
    userPrompt: input.isRegeneration
      ? `${userPrompt}\n\n${regenerationBlock(input.previousDraft, input.chrisInstruction)}`
      : userPrompt,
  });
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

Cut description before you cut information. A sentence about how the light or the location will look carries nothing and goes first.

Do not introduce any new date, time, or price, and do not drop one to save words.

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

/**
 * Pulls the wording back toward Chris's voice, facts untouched.
 *
 * Rewritten because this button did not work. It used to say "match the
 * rhythm, warmth, and sentence length of the approved examples above", which
 * aimed the model at a corpus that was itself the source of the generic
 * phrasing — so pressing it produced another generic draft with more
 * contractions. Now it names the specific faults to remove.
 */
export async function naturalizeDraft(
  input: EditInput,
  call: EmailModelCaller,
): Promise<OperationResult> {
  const context = buildEmailContext(input);
  // Examples earn their place here: this operation is entirely about voice,
  // and they are now stage-matched, so a short reply gets short models.
  const system = buildSystemPrompt(context, selectPromptRules(input.rules));
  const [minWords, maxWords] = context.conversation.shape.targetWords;

  const userPrompt = `Here is the current draft:

<draft>
${input.currentDraft}
</draft>

This draft is accurate but it does not sound like Chris. Rewrite it so it does. Work through these specific faults and remove every one you find:

1. Sentences that describe how the photos, light, or location will look. "The light at the beach is going to be lovely", "it'll look great on the stairs", "should be a beautiful evening". Delete them outright. Do not replace them with a better description.
2. Descriptions of a place the CLIENT chose. If they named the location, Chris does not tell them about it. Keep a location description only where Chris is the one suggesting somewhere new, and then one clause.
3. Padding around a fact. "So glad that works!" becomes "Perfect!". "The champagne setup is a fun add-on, and it's $15" becomes "The champagne add-on is $15".
4. A price explained or justified rather than stated. State it and move on.
5. Two closings doing the same work. The ask and the next step go in one sentence.
6. Anything already settled earlier in this thread, restated.
7. Marketing register of any kind. He is a person replying to a person, not a business describing its service.

${bulletiseCorrections()}

Every fact stays exactly as it is: the same dates, the same times, the same prices, the same questions, the same next step, the same booking status. This is a voice change only, so do not add information and do not remove a fact to make it shorter.

Aim for ${minWords} to ${maxWords} words, which is what Chris writes at this stage of a conversation.

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

function bulletiseCorrections(): string {
  return `Phrasings Chris has rejected, and what he writes instead:\n${PHRASING_CORRECTIONS.map((c) => `- ${c}`).join("\n")}`;
}
