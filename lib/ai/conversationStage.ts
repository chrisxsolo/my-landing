// ─────────────────────────────────────────────────────────────────────────────
// Where this conversation actually is.
//
// The system had no notion of this. Every draft was shaped like a first reply:
// `pickScenarios` in buildEmailContext chose which EXAMPLES to retrieve, but
// nothing told the model what kind of email this turn calls for, and the
// session playbook ("cover availability, price, then the booking step") shipped
// in full whether the client was asking an opening question or confirming a
// time already agreed.
//
// That is why a client confirming "yes, 5:45 works" received a fresh pitch
// complete with lighting description, price, and the booking step. The facts
// were right. The email was wrong, because it answered the wrong question.
//
// Detection is deterministic. It reads the thread, the inquiry record, and the
// verified administrative status — no model call, because an LLM asked "what
// stage is this" costs a request and can still be wrong about something a
// timestamp already settles.
//
// Evidence for the per-stage shapes is now 156 real turns pulled from Gmail,
// each one a point where a client wrote and Chris replied, with the reply he
// actually sent as the reference. The pattern that holds up: his FIRST replies
// open "Thank you so much for reaching out!" and his later replies never do.
// They open "Perfect!", "Sounds good!", "That works perfectly!", "Absolutely!",
// "No worries at all!", "Thank you so much for catching that!".
//
// The pattern that did NOT hold up is length. The hand-set budgets matched his
// real replies only 51% of the time and he wrote longer than the ceiling 35%
// of the time, so they are now fitted to the corpus and rendered as a habit
// rather than a limit. See renderStage.
// ─────────────────────────────────────────────────────────────────────────────

import type { ThreadDigest } from "./threadDigest";
import type { AdminStatus } from "./adminStatus";

export type ConversationStage =
  | "initial_inquiry"
  | "information_gathering"
  | "pricing_discussion"
  | "availability_discussion"
  | "scheduling"
  | "booking_confirmation"
  | "logistics_coordination"
  | "rescheduling"
  | "post_session"
  | "decline_or_close_out"
  | "general_follow_up";

export type StageShape = {
  stage: ConversationStage;
  /** One line naming the job of this email. */
  job: string;
  /** How to open, in Chris's own register for this stage. */
  opening: string;
  /** Things this stage should normally leave out. */
  omit: string[];
  /**
   * Word range, calibrated to Chris's own sent emails at this stage.
   *
   * Measured over 156 real turns with the reply he actually sent: p10 to p90,
   * rounded. The previous numbers were set by hand and were wrong — only 51%
   * of his real replies fell inside them, he wrote LONGER than the ceiling 35%
   * of the time, and the validator's `too_long` check consequently flagged 22%
   * of his own emails. Stages with fewer than 10 observed turns use the
   * all-turns range rather than being fitted to two or three samples.
   */
  targetWords: [number, number];
};

const SHAPES: Record<ConversationStage, Omit<StageShape, "stage">> = {
  initial_inquiry: {
    job: 'Answer their opening question, give them real dates, and tell them how booking works once. He almost always ends a first reply with "Looking forward to hearing back from you!"',
    opening: `Open "Thank you so much for reaching out!" and then say you'd love to do the specific session they asked for. If they are graduating or newly engaged, the congratulations belongs in that same first sentence or the line right after, never bolted onto the end of the "I'd love to" sentence.`,
    omit: ["turnaround time", "retainer percentages", "add-on menus they did not ask about"],
    targetWords: [85, 150], // n=52
  },
  information_gathering: {
    job: "Ask only for what you genuinely still need, and nothing you were already told.",
    opening: `A short acknowledgement, not a fresh introduction. "Thanks for the details!" or "Sounds good!"`,
    omit: ["the full price list", "the booking step if nothing is close to settled", "anything they already answered"],
    targetWords: [30, 145], // n=6, all-turns range
  },
  pricing_discussion: {
    job: "Give them the number plainly, and the total when every part of it is known.",
    opening: `Answer the price question in the first sentence. No preamble.`,
    omit: ["re-selling the session", "location descriptions", "availability they did not ask about"],
    targetWords: [30, 145], // n=3, all-turns range
  },
  availability_discussion: {
    job: "Say what is open, say plainly what is not, and suggest a start time.",
    opening: `Lead with the answer. If their date does not work, "Unfortunately, I'm not available <date>, but I am available <alternatives>" is how Chris says it.`,
    omit: ["price if already quoted", "the booking step if no date is chosen yet"],
    targetWords: [30, 125], // n=17
  },
  scheduling: {
    job: "Lock the date and time, and say what happens next once.",
    opening: `A short confirming word. "Perfect!", "That works perfectly!", "Sounds good!"`,
    omit: ["price if already quoted", "location descriptions", "questions already answered"],
    targetWords: [40, 105], // n=15
  },
  booking_confirmation: {
    job: "Confirm the settled details in one line and say where the invoice and contract stand.",
    opening: `"Perfect!" then straight to the confirmation.`,
    omit: ["re-quoting the price", "lighting or location descriptions", "offering other dates", "asking anything already settled"],
    targetWords: [20, 75], // n=13
  },
  logistics_coordination: {
    job: "Answer the practical question. Meeting point, parking, what to wear, weather, who can come.",
    opening: `Answer it immediately. "Good question!" or "Thank you so much for catching that!" if they spotted something.`,
    omit: ["price", "the booking step", "availability", "re-confirming the date unless they asked"],
    targetWords: [20, 100], // n=39
  },
  rescheduling: {
    job: "Say what you can do for the new date and keep everything else as it stands.",
    opening: `"No worries at all!" then the new options.`,
    omit: ["re-quoting the price", "re-explaining booking", "the original date's details"],
    targetWords: [30, 145], // n<10, all-turns range
  },
  post_session: {
    job: "Answer about the gallery, delivery, or anything after the shoot.",
    opening: `Warm and brief. If the gallery is ready, lead with that.`,
    omit: ["price", "availability", "the booking step"],
    targetWords: [30, 145], // n=1, all-turns range
  },
  decline_or_close_out: {
    job: "Say you cannot do it, thank them sincerely, and leave the door open. One short paragraph each.",
    opening: `"Thank you so much for reaching out!" then the "unfortunately" in the next line.`,
    omit: ["price", "alternative dates if there genuinely are none", "the booking step"],
    targetWords: [30, 145], // n<10, all-turns range
  },
  general_follow_up: {
    job: "Answer what they asked and nothing more.",
    opening: `A short acknowledgement sized to their message.`,
    omit: ["anything they did not ask about"],
    targetWords: [20, 160], // n=10
  },
};

/** Words that mean the client is asking what something costs. */
const PRICE_QUESTION = /\b(?:how much|price|pricing|rate|rates|cost|costs|quote|charge|fee|budget|afford|deposit|package)\b/i;
/** Words that mean the client is asking when. */
const DATE_QUESTION = /\b(?:available|availability|open|free|book|date|dates|weekend|time|when)\b/i;
/** Words that mean the client is asking a practical, on-the-day question. */
const LOGISTICS_QUESTION =
  /\b(?:meet|meeting|park|parking|wear|wearing|outfit|bring|pets?|dogs?|weather|rain|late|address|directions|pin|where exactly|how long|arrive|traffic)\b/i;
const RESCHEDULE = /\b(?:reschedul|move the session|change the date|push (?:it|the session)|different date|postpone|cancel)\b/i;
const POST_SESSION = /\b(?:gallery|photos ready|edited photos|download|link to (?:the|my) photos|turnaround|when will (?:the|my) photos)\b/i;
const DECLINING_CLIENT = /\b(?:went with|found another|decided to go with|no longer need|too expensive|out of (?:our|my) budget)\b/i;
/**
 * Unambiguously asking what it costs, or what is open.
 *
 * Deliberately much narrower than PRICE_QUESTION and DATE_QUESTION, which are
 * fine for ranking one stage against another but far too loose to override a
 * post-session signal: DATE_QUESTION matches the bare words "when" and "time",
 * so "when will my photos be ready" read as an availability question.
 *
 * These two exist only to stop a strong post-session keyword swallowing a real
 * booking question, which is what happened to "what do you charge for
 * additional edited photos? Are you available October 3rd?" — POST_SESSION
 * matched "edited photos" and the availability question went unanswered.
 */
const EXPLICIT_PRICE_ASK =
  /\b(?:how much|what do you charge|what would .{0,20}cost|price|pricing|rates?|cost of)\b/i;
const EXPLICIT_DATE_ASK =
  /\b(?:are you (?:available|free)|do you have .{0,40}(?:available|open|spots?)|availability|any openings|other dates|reschedul\w*)\b/i;
/** The client agreeing to something specific. */
const ACCEPTANCE = /\b(?:let'?s do|works(?: for (?:me|us))?|sounds good|yes,? (?:let'?s|that|please)|i'?ll take|book (?:it|that)|go ahead|can we take|i would like to (?:go ahead|book))\b/i;

export type StageInput = {
  digest: ThreadDigest;
  admin: AdminStatus;
  /** The client's newest message, when there is one. */
  latestClientMessage: string | null;
  /** The inquiry form message, always available. */
  inquiryMessage: string;
  /** True when a date has been settled, from the inquiry record. */
  hasSessionDate: boolean;
};

/**
 * Picks the stage.
 *
 * Ordered by how decisive the evidence is, not by how far along the booking
 * is: a paid deposit plus a question about parking is logistics, not a booking
 * confirmation, and answering it with booking information is the failure this
 * function exists to prevent.
 */
export function detectStage(input: StageInput): ConversationStage {
  const { digest, admin, latestClientMessage, inquiryMessage, hasSessionDate } = input;
  const text = (latestClientMessage ?? inquiryMessage ?? "").toLowerCase();

  // Two different questions, and the old code answered both with one boolean.
  //
  // `pastOpening` — is this conversation beyond its first exchange? Paperwork
  // going out is good evidence of that, so invoice and contract count here.
  //
  // `paidFor` — has the client actually paid? Only the deposit answers that.
  // The old `booked` folded invoiceSent into this, which made six live
  // inquiries with an invoice and no payment look paid, and a draft telling a
  // client their session is secured before they have paid is the single worst
  // thing this file can cause.
  const pastOpening = admin.depositPaid || admin.bookingConfirmed
    || admin.invoiceSent || admin.contractSent;
  const paidFor = admin.depositPaid;
  const settled = pastOpening || Boolean(admin.sessionDate);

  // No prior email at all: this is the reply to the form submission.
  if (digest.messageCount <= 1 && !latestClientMessage && !settled) return "initial_inquiry";

  if (DECLINING_CLIENT.test(text)) return "decline_or_close_out";
  if (RESCHEDULE.test(text)) return "rescheduling";

  // After the shoot, or asking about delivery.
  //
  // Guarded, because this was the single biggest misclassifier. "What do you
  // charge for additional edited photos? Are you available October 3rd?" hit
  // POST_SESSION on "edited photos" and was answered as a delivery question,
  // and a delivered gallery forced every later turn to post_session whatever
  // the client asked. An explicit price or date question outranks both.
  // Strict: only an unmistakable booking question may override a strong
  // post-session signal.
  const explicitlyAsksPriceOrDate = EXPLICIT_PRICE_ASK.test(text) || EXPLICIT_DATE_ASK.test(text);
  if ((admin.galleryDelivered || POST_SESSION.test(text)) && !explicitlyAsksPriceOrDate) {
    return "post_session";
  }

  // Loose: good enough to rank one stage against another, which is all the
  // catch-all below uses it for.
  const asksPriceOrDate = PRICE_QUESTION.test(text) || DATE_QUESTION.test(text);

  // Past the opening and asking how the day works. Checked BEFORE acceptance
  // so "sounds good, where should we park?" gets a logistics answer rather
  // than a booking one.
  if (pastOpening && LOGISTICS_QUESTION.test(text)) return "logistics_coordination";

  // They have said yes to something concrete.
  //
  // This now sits ABOVE the catch-all below, which it did not before. The
  // catch-all fires on "past the opening and no price or date word in the
  // message", and "October 20th works for me!" contains neither — so a client
  // accepting a date on an invoiced session was answered as a logistics
  // query. Acceptance is specific evidence; the catch-all is a fallback, and
  // a fallback must not outrank evidence.
  if (ACCEPTANCE.test(text) && (hasSessionDate || digest.datesDiscussed.length > 0)) {
    // Money in means the booking is being confirmed. Paperwork merely sent
    // does not: they are still choosing, and that is scheduling.
    return paidFor ? "booking_confirmation" : "scheduling";
  }

  if (pastOpening && !asksPriceOrDate) return "logistics_coordination";
  if (admin.invoiceSent || admin.contractSent) return "booking_confirmation";
  if (settled && digest.messageCount <= 1) return "booking_confirmation";

  if (LOGISTICS_QUESTION.test(text) && hasSessionDate) return "logistics_coordination";

  // A price question outranks a date question: it is the more specific ask,
  // and "what are your rates for the 19th?" is a pricing reply with a date in
  // it, not an availability reply with a price in it.
  if (PRICE_QUESTION.test(text)) return "pricing_discussion";
  if (DATE_QUESTION.test(text)) return "availability_discussion";

  // Chris asked for details and they answered.
  if (digest.messageCount >= 2 && !digest.awaitingChrisReply) return "general_follow_up";
  if (digest.openQuestions.length > 0) return "general_follow_up";

  return "information_gathering";
}

export function stageShape(stage: ConversationStage): StageShape {
  return { stage, ...SHAPES[stage] };
}

/**
 * The stage section of the prompt. Advisory, not a script.
 *
 * It used to read as an instruction: a flat omit list and a hard word budget.
 * Both were wrong often enough to do damage. Measured over 156 real turns,
 * with period-correct booking state, 13 of the 26 turns where a client
 * explicitly asked about a price or a date landed on a stage whose omit list
 * told the model to leave that out — and in 6 of them Chris's real reply
 * contained exactly the thing being suppressed.
 *
 * So the omit list now carries an explicit exception, and the word range is
 * described as what he typically writes rather than as a ceiling. The stage
 * itself is kept: it still earns its place choosing examples and holding the
 * line on "this is not a first reply", which the corpus supports strongly.
 */
export function renderStage(shape: StageShape, digest: ThreadDigest): string {
  const lines = [
    `Stage, as far as the record can tell: ${shape.stage.replace(/_/g, " ")}. This is a hint from timestamps and keywords, not a reading of their language. Their latest message is the authority on what this email owes them.`,
    `Job of this email, if the hint is right: ${shape.job}`,
    `Opening: ${shape.opening}`,
    `Usually left out at this stage, UNLESS their latest message actually asks about it, in which case answer it: ${shape.omit.join("; ")}.`,
    `Length: Chris's own replies at this stage run about ${shape.targetWords[0]} to ${shape.targetWords[1]} words. That is a description of his habit, not a budget. Let what they asked decide, and do not pad to reach it or cut a real answer to stay inside it.`,
  ];
  if (shape.stage !== "initial_inquiry" && digest.messageCount > 1) {
    lines.push(
      'This is NOT a first reply. Do not reintroduce yourself and do not write "Thank you so much for reaching out" — that line belongs only to the first email in a conversation.',
    );
  }
  return lines.join("\n");
}
