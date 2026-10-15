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
// Evidence for the per-stage shapes is 43 of Chris's own sent emails. The
// pattern that matters most: his FIRST replies open "Thank you so much for
// reaching out!" and run 80-130 words, and his later replies never do. They
// open "Perfect!", "Sounds good!", "That works perfectly!", "Absolutely!",
// "No worries at all!", "Thank you so much for catching that!" and run 25-60.
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
  /** Word budget. His own emails at this stage, rounded. */
  targetWords: [number, number];
};

const SHAPES: Record<ConversationStage, Omit<StageShape, "stage">> = {
  initial_inquiry: {
    job: 'Answer their opening question, give them real dates, and tell them how booking works once. He almost always ends a first reply with "Looking forward to hearing back from you!"',
    opening: `Open "Thank you so much for reaching out!" and then say you'd love to do the specific session they asked for. If they are graduating or newly engaged, the congratulations belongs in that same first sentence or the line right after, never bolted onto the end of the "I'd love to" sentence.`,
    omit: ["turnaround time", "retainer percentages", "add-on menus they did not ask about"],
    targetWords: [80, 130],
  },
  information_gathering: {
    job: "Ask only for what you genuinely still need, and nothing you were already told.",
    opening: `A short acknowledgement, not a fresh introduction. "Thanks for the details!" or "Sounds good!"`,
    omit: ["the full price list", "the booking step if nothing is close to settled", "anything they already answered"],
    targetWords: [50, 100],
  },
  pricing_discussion: {
    job: "Give them the number plainly, and the total when every part of it is known.",
    opening: `Answer the price question in the first sentence. No preamble.`,
    omit: ["re-selling the session", "location descriptions", "availability they did not ask about"],
    targetWords: [40, 100],
  },
  availability_discussion: {
    job: "Say what is open, say plainly what is not, and suggest a start time.",
    opening: `Lead with the answer. If their date does not work, "Unfortunately, I'm not available <date>, but I am available <alternatives>" is how Chris says it.`,
    omit: ["price if already quoted", "the booking step if no date is chosen yet"],
    targetWords: [40, 90],
  },
  scheduling: {
    job: "Lock the date and time, and say what happens next once.",
    opening: `A short confirming word. "Perfect!", "That works perfectly!", "Sounds good!"`,
    omit: ["price if already quoted", "location descriptions", "questions already answered"],
    targetWords: [35, 80],
  },
  booking_confirmation: {
    job: "Confirm the settled details in one line and say where the invoice and contract stand.",
    opening: `"Perfect!" then straight to the confirmation.`,
    omit: ["re-quoting the price", "lighting or location descriptions", "offering other dates", "asking anything already settled"],
    targetWords: [30, 80],
  },
  logistics_coordination: {
    job: "Answer the practical question. Meeting point, parking, what to wear, weather, who can come.",
    opening: `Answer it immediately. "Good question!" or "Thank you so much for catching that!" if they spotted something.`,
    omit: ["price", "the booking step", "availability", "re-confirming the date unless they asked"],
    targetWords: [40, 110],
  },
  rescheduling: {
    job: "Say what you can do for the new date and keep everything else as it stands.",
    opening: `"No worries at all!" then the new options.`,
    omit: ["re-quoting the price", "re-explaining booking", "the original date's details"],
    targetWords: [35, 90],
  },
  post_session: {
    job: "Answer about the gallery, delivery, or anything after the shoot.",
    opening: `Warm and brief. If the gallery is ready, lead with that.`,
    omit: ["price", "availability", "the booking step"],
    targetWords: [30, 90],
  },
  decline_or_close_out: {
    job: "Say you cannot do it, thank them sincerely, and leave the door open. One short paragraph each.",
    opening: `"Thank you so much for reaching out!" then the "unfortunately" in the next line.`,
    omit: ["price", "alternative dates if there genuinely are none", "the booking step"],
    targetWords: [30, 70],
  },
  general_follow_up: {
    job: "Answer what they asked and nothing more.",
    opening: `A short acknowledgement sized to their message.`,
    omit: ["anything they did not ask about"],
    targetWords: [30, 90],
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

  // Paperwork out, money in, or a date on the record means this conversation
  // is well past its opening, even when the thread could not be loaded. Gmail
  // access can fail; the record cannot, and treating a booked client as a new
  // inquiry is how they get re-pitched a session they already paid for.
  const booked = admin.depositPaid || admin.bookingConfirmed || admin.invoiceSent;
  const settled = booked || Boolean(admin.sessionDate);

  // No prior email at all: this is the reply to the form submission.
  if (digest.messageCount <= 1 && !latestClientMessage && !settled) return "initial_inquiry";

  if (DECLINING_CLIENT.test(text)) return "decline_or_close_out";
  if (RESCHEDULE.test(text)) return "rescheduling";

  // After the shoot, or asking about delivery.
  if (admin.galleryDelivered || POST_SESSION.test(text)) return "post_session";

  // Booked and paid, now asking how the day works. Checked BEFORE
  // booking_confirmation so a parking question does not get a booking email.
  if (booked && LOGISTICS_QUESTION.test(text)) return "logistics_coordination";
  if (booked && !PRICE_QUESTION.test(text) && !DATE_QUESTION.test(text)) return "logistics_coordination";

  // They have said yes to something concrete and the booking is not yet done.
  if (ACCEPTANCE.test(text) && (hasSessionDate || digest.datesDiscussed.length > 0)) {
    // Paperwork out or money in means the booking is being confirmed, not
    // still being scheduled.
    return booked ? "booking_confirmation" : "scheduling";
  }
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

/** The stage section of the prompt. Short on purpose: it replaces guesswork,
 *  it is not a second playbook. */
export function renderStage(shape: StageShape, digest: ThreadDigest): string {
  const lines = [
    `Stage: ${shape.stage.replace(/_/g, " ")}.`,
    `Job of this email: ${shape.job}`,
    `Opening: ${shape.opening}`,
    `Leave out: ${shape.omit.join("; ")}.`,
    `Length: ${shape.targetWords[0]} to ${shape.targetWords[1]} words is what Chris writes at this stage. A reply that runs past it is explaining rather than answering.`,
  ];
  if (shape.stage !== "initial_inquiry" && digest.messageCount > 1) {
    lines.push(
      'This is NOT a first reply. Do not reintroduce yourself and do not write "Thank you so much for reaching out" — that line belongs only to the first email in a conversation.',
    );
  }
  return lines.join("\n");
}
