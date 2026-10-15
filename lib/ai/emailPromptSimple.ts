// ─────────────────────────────────────────────────────────────────────────────
// The simplified prompt.
//
// Same verified facts as lib/ai/emailPrompt.ts — it imports the very same
// renderers, so a fact cannot differ between the two architectures and the A/B
// comparison stays about prompt strategy alone. Three things change:
//
//  1. Conversation position is ADVISORY, not an instruction. The old prompt
//     shipped a per-stage omit list and word budget derived from a keyword
//     classifier. Measured against 156 real turns, that classifier let the
//     administrative record override the client's own words, and in 6 of the
//     26 turns where a client explicitly asked about a price or a date it told
//     the model to leave that out — while Chris's real reply contained it.
//     Claude reads the thread and decides what the email covers.
//
//  2. Style guidance is consolidated. The old stable prompt carried 26 banned
//     phrases, 11 style notes and 7 phrasing corrections, several saying the
//     same thing and one contradicting the availability section. The banned
//     list is dropped from the prompt because validateEmailDraft already
//     catches every entry deterministically after the fact — paying input
//     tokens to list them was buying prevention the validator provides free.
//
//  3. The session playbook ships only when it is relevant: on a genuine first
//     reply, or when no published rate covers the session and the playbook is
//     what says "do not quote one". On a follow-up with a verified price its
//     first-reply shape is noise.
// ─────────────────────────────────────────────────────────────────────────────

import { VOICE, PERMANENT_RULES, getPlaybook } from "./soloxsnapsWritingProfile";
import {
  INJECTION_GUARD, OUTPUT_CONTRACT, bulletise,
  renderAvailability, renderPricing, renderGoldenHour, renderExamples,
} from "./emailPrompt";
import type { EmailContext } from "./buildEmailContext";
import type { SystemPrompt } from "./emailModel";
import type { WritingRule } from "./writingRules";

/**
 * Style guidance, deduplicated.
 *
 * Every line here says one thing no other line says. Dropped from the old set:
 * the date-formatting note (the availability section already states it, and
 * stating it twice in different words is how the two drifted apart), and the
 * separate apology and golden-hour notes, which were restatements of "one
 * sentence, not three" and "never describe how it will look".
 */
export const STYLE_CONSOLIDATED: readonly string[] = [
  "Answer what they asked, say what happens next, stop. Length follows from that and from nothing else: a one-line question gets a short reply, a first inquiry with four questions in it gets a longer one.",
  'Say prices plainly, then stop: "My graduation sessions start at $350". No framing, no justifying, no explaining the value.',
  "Warmth is one genuine sentence, never three. That covers congratulations, sympathy, and apologies for a late reply alike.",
  "Never predict how the photos, the light, or a place will look. No sentence about light on a building, a staircase, a backdrop, or a landscape. Timing advice is useful, scenery commentary is not.",
  "Describe a location only when you are the one suggesting it, and then in one clause about why it suits them. If the client named the place, do not describe it back to them.",
  "Do not read their details back to them. They know how many people are coming and what they asked for.",
  "Suggest a start time on the quarter hour, the way a person does. Never a time like 5:18 pm.",
  "One closing, not two. The ask and the next step belong in the same sentence.",
  "Do not restate anything already settled earlier in this conversation.",
  "Never refer to information you have not been given. Do not write \"here's my number\" or \"here's the link\" unless the actual number or link is in front of you.",
  "No marketing register. You are a person replying to a person, not a business describing its service. No stock photography phrasing of any kind.",
];

/**
 * The concrete pairs worth their tokens.
 *
 * Trimmed from seven to four: three of the originals were worked examples of
 * "never predict how it will look", which the style list now states once.
 */
export const PHRASING_CONSOLIDATED: readonly string[] = [
  'Not "I\'d love to shoot your graduation, and congratulations!" → "Thank you so much for reaching out, and congratulations on graduating! I\'d love to take your graduation pictures!"',
  'Not "So glad 5:45 pm works!" → "Perfect! October 16th at 5:45 pm works for me!"',
  'Not "My graduation session is $350 per hour" → "My graduation sessions start at $350"',
  'Not "The champagne setup is a fun add-on, and it\'s $15" → "The champagne add-on is $15"',
];

/** How many examples a variant gets, and how they are chosen. */
export type ExampleMode = "retrieved" | "broad" | "none";

export type SimplePromptOptions = {
  exampleMode?: ExampleMode;
  /** Surgical edits want the facts and rules but not whole emails to imitate. */
  includeExamples?: boolean;
};

/**
 * The stable, cacheable half.
 *
 * Playbook inclusion is deliberately a function of the context rather than a
 * constant, which does cost a cache entry per shape. That is two or three
 * prefixes instead of one, and each is still reused across every draft that
 * shares it.
 */
export function buildSimpleStableSystem(
  context: EmailContext,
  approvedRules: WritingRule[],
): string {
  const sections = [
    `# Who you are\n${VOICE}`,
    `# Security\n${INJECTION_GUARD}`,
    `# Hard rules — never break these\n${bulletise(PERMANENT_RULES)}`,
    `# Style\n${bulletise(STYLE_CONSOLIDATED)}`,
    `# Phrasing Chris has rejected, and what he writes instead\n${bulletise(PHRASING_CONSOLIDATED)}`,
  ];

  // Relevant when this is the opening reply, or when the playbook is carrying
  // the "there is no published rate, do not invent one" instruction.
  const wantsPlaybook = context.thread.digest.messageCount <= 1 || !context.pricing.verified;
  const playbook = wantsPlaybook ? getPlaybook(context.client.playbook) : null;
  if (playbook) sections.push(`# Shape of a ${context.client.playbook} reply\n${playbook}`);

  if (approvedRules.length) {
    sections.push(
      `# Learned preferences\nChris approved these. They refine the style above and never override the hard rules.\n${bulletise(approvedRules.map((r) => r.rule))}`,
    );
  }

  sections.push(`# Output\n${OUTPUT_CONTRACT}`);
  return sections.join("\n\n");
}

/**
 * Where the conversation is, stated as evidence rather than as a script.
 *
 * The facts here are the ones a timestamp settles — how many messages exist,
 * whether any are Chris's, how long it has been. What those facts imply about
 * the shape of the reply is left to the model, because that is a reading of
 * the client's language and the classifier was measurably bad at it.
 */
export function renderPosition(context: EmailContext, threadKnown: boolean): string {
  const { digest } = context.thread;
  const lines: string[] = [];

  if (!threadKnown) {
    lines.push(
      "The email history for this client could not be loaded, so you do not know what has already been said. Treat the inquiry below as the only thing you know they wrote. Do not refer to an earlier message, do not imply anything was already agreed, and do not thank them for something you cannot see.",
    );
  } else if (digest.messageCount === 0) {
    lines.push(
      "There is no email history with this client. This is your first reply, and it answers the inquiry they submitted through the website.",
    );
  } else {
    lines.push(
      `This conversation already has ${digest.messageCount} message${digest.messageCount === 1 ? "" : "s"} in it, shown below. This is NOT a first reply: do not reintroduce yourself and do not write "Thank you so much for reaching out", which belongs only to the opening email of a conversation.`,
    );
    if (digest.daysSinceLastMessage !== null && digest.daysSinceLastMessage >= 3 && digest.awaitingChrisReply) {
      lines.push(`It has been ${digest.daysSinceLastMessage} days since their last message and they are waiting on you, so one sincere line about the delay is appropriate.`);
    }
  }

  lines.push(
    "Read their latest message and decide for yourself what this email needs to do. If they asked a question, answer it, whatever else the booking state might suggest. If they settled something, treat it as settled.",
  );
  return lines.join("\n");
}

/**
 * Broad relevance: one first-reply model, or one short follow-up model.
 *
 * Deliberately cruder than the scored retrieval it is tested against — the
 * question that run answers is whether the scoring earns its complexity.
 */
function broadExamples(context: EmailContext): EmailContext["examples"] {
  const wantFirst = context.thread.digest.messageCount <= 1;
  const pool = context.examples;
  const picked = pool.filter((example) =>
    wantFirst
      ? example.scenarios.includes("first-reply") || example.scenarios.includes("initial_inquiry")
      : !example.scenarios.includes("first-reply"),
  );
  return (picked.length ? picked : pool).slice(0, wantFirst ? 1 : 2);
}

export function buildSimpleVolatileSystem(
  context: EmailContext,
  threadKnown: boolean,
  options: SimplePromptOptions = {},
): string {
  const sections = [
    `# Where this conversation is\n${renderPosition(context, threadKnown)}`,
    `# Verified booking status — what you may and may not claim\n${bulletise(context.admin.lines)}`,
    `# Verified availability\n${renderAvailability(context)}`,
    `# Verified pricing — the only prices you may state\n${renderPricing(context)}`,
    `# Timing\n${renderGoldenHour(context)}`,
    `# What this thread already establishes\n${bulletise(context.thread.lines)}`,
    `# Contact and signature\n${bulletise(context.contact)}`,
    `# Facts you do not have\nAnything not stated above is unknown. Do not fill a gap with something plausible. Ask, or leave it out.`,
  ];

  const mode: ExampleMode = options.includeExamples === false ? "none" : (options.exampleMode ?? "retrieved");
  if (mode !== "none") {
    const chosen = mode === "broad" ? broadExamples(context) : context.examples;
    const rendered = renderExamples({ ...context, examples: chosen });
    if (rendered) sections.push(`# Approved examples — voice only\n${rendered}`);
  }

  return sections.join("\n\n");
}

export function buildSimpleSystemPrompt(
  context: EmailContext,
  approvedRules: WritingRule[],
  threadKnown: boolean,
  options: SimplePromptOptions = {},
): SystemPrompt {
  return {
    stable: buildSimpleStableSystem(context, approvedRules),
    volatile: buildSimpleVolatileSystem(context, threadKnown, options),
  };
}
