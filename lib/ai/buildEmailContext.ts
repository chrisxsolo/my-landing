// ─────────────────────────────────────────────────────────────────────────────
// Structured context for one draft.
//
// Everything the model is allowed to treat as true is assembled here, by
// ordinary TypeScript, before any API call. Unknown stays unknown: a missing
// field is absent from the object rather than filled with a plausible guess,
// and `warnings` tells the admin UI what could not be verified.
//
// No model call happens in this file. That is the whole point — the old
// pipeline spent requests working out things a database query already knew.
// ─────────────────────────────────────────────────────────────────────────────

import { classifySession } from "./sessionClassifier";
import { TRAVEL_RATE_LABEL } from "@/lib/travelFee";
import { buildPricingFacts, buildTravelFact, buildPolicyFacts, buildContactFacts, type PricingFacts } from "./businessFacts";
import { buildGoldenHourWindow, goldenHourCaveat, type GoldenHourWindow } from "./goldenHour";
import { buildThreadDigest, renderThreadDigest, type ThreadDigest, type ThreadMessage } from "./threadDigest";
import { selectExamples, type ApprovedExample, type ExampleScenario } from "./approvedExamples";
import { detectStage, stageShape, type ConversationStage, type StageShape } from "./conversationStage";
import { buildAdminStatus, renderAdminStatus, type AdminStatus, type InquiryAdminRow } from "./adminStatus";

export type AvailabilityEntry = {
  date: string;
  label: string;
  note: string | null;
};

export type AvailabilitySnapshot = {
  asOf: string;
  available: AvailabilityEntry[];
  onHold: AvailabilityEntry[];
  booked: AvailabilityEntry[];
};

export type InquiryInput = {
  name: string;
  email: string;
  phone?: string | null;
  sessionType?: string | null;
  message: string;
  dateInMind?: string | null;
  preferredTime?: string | null;
  location?: string | null;
  school?: string | null;
  people?: string | number | null;
  instagram?: string | null;
};

export type ContextWarning = {
  code:
    | "availability_unverified"
    | "availability_time_unverified"
    | "pricing_unverified"
    | "travel_unverified"
    | "session_type_unknown"
    | "session_type_ambiguous"
    | "requested_date_unavailable"
    | "booking_state_uncertain"
    | "thread_not_loaded";
  severity: "high" | "medium" | "low";
  message: string;
};

export type EmailContext = {
  client: {
    name: string;
    firstName: string;
    sessionType: string | null;
    playbook: string | null;
  };
  request: {
    dateInMind: string | null;
    preferredTime: string | null;
    location: string | null;
    school: string | null;
    people: string | null;
    rawMessage: string;
  };
  availability: {
    /** False when the availability table could not be read at all. */
    verified: boolean;
    asOf: string | null;
    /** Dates Chris may actually offer. */
    offerable: AvailabilityEntry[];
    /** Dates he must not offer, with the reason. */
    unavailable: AvailabilityEntry[];
    /** Date-level only: no time windows exist in the schema. */
    timeVerified: false;
    requestedDateStatus: "available" | "booked" | "on_hold" | "unknown" | null;
  };
  pricing: PricingFacts & { travelFact: string | null };
  policy: string[];
  /** Phone number and signature behaviour, so no draft dangles a reference. */
  contact: string[];
  goldenHour: { window: GoldenHourWindow | null; caveat: string | null };
  thread: { digest: ThreadDigest; lines: string[] };
  /** Where the conversation is, and the shape of email this turn calls for. */
  conversation: { stage: ConversationStage; shape: StageShape };
  /** Invoice, contract, deposit and gallery state, from the record. */
  admin: AdminStatus & { lines: string[] };
  examples: ApprovedExample[];
  warnings: ContextWarning[];
};

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** Turns "Nov 26" / "2026-11-26" into an ISO date when it can, else null. */
export function normalizeDateInMind(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  // A bare "November 26" parses into the current year, which is right for an
  // upcoming shoot and wrong for nothing we can detect here.
  return parsed.toISOString().slice(0, 10);
}

/**
 * Which approved examples this situation calls for.
 *
 * The conversation stage leads, because matching the SHAPE of the email
 * matters more than matching the session type. The legacy scenario hints stay
 * so a late reply or a declined date still pulls its specific example.
 */
function pickScenarios(
  stage: ConversationStage,
  digest: ThreadDigest,
  requestedDateStatus: EmailContext["availability"]["requestedDateStatus"],
  hasOfferableDates: boolean,
): ExampleScenario[] {
  const scenarios: ExampleScenario[] = [stage];

  // Only a genuine first reply, so a long inquiry-shaped example cannot win
  // retrieval on a thread that is five messages deep.
  if (stage === "initial_inquiry") scenarios.push("first-reply");
  if (digest.daysSinceLastMessage !== null && digest.daysSinceLastMessage >= 3 && digest.awaitingChrisReply) {
    scenarios.push("late-reply");
  }
  if (requestedDateStatus === "booked" || requestedDateStatus === "on_hold") {
    scenarios.push("alternative-availability");
  }
  if (!hasOfferableDates && requestedDateStatus === "booked") scenarios.push("declining");

  return scenarios;
}

/** Tags that steer example retrieval, read off the client's own words. */
function pickTags(input: InquiryInput): string[] {
  const text = `${input.message} ${input.location ?? ""} ${input.preferredTime ?? ""}`.toLowerCase();
  const tags: string[] = [];
  if (/beach|ocean|coast|crissy|baker/.test(text)) tags.push("beach");
  if (/sunset|golden hour|evening/.test(text)) tags.push("golden_hour", "sunset");
  if (/sunrise|morning/.test(text)) tags.push("sunrise");
  if (/passed away|loss|died|funeral|hospice|ill|sick|last time/.test(text)) tags.push("sensitive", "loss");
  if (/surprise|hidden|hide|secret/.test(text)) tags.push("surprise");
  if (/price|cost|rate|how much|pricing/.test(text)) tags.push("pricing");
  if (/travel|drive|come to|outside/.test(text)) tags.push("travel");
  if (/location|where|spot|venue/.test(text)) tags.push("location");
  return tags;
}

export type BuildEmailContextInput = {
  inquiry: InquiryInput;
  messages: ThreadMessage[];
  availability: AvailabilitySnapshot | null;
  /** True when the Gmail thread genuinely has no messages, vs failed to load. */
  threadLoaded: boolean;
  /**
   * The authoritative inquiry row. Read server-side from the id, never taken
   * from the client: administrative claims are exactly the thing a browser
   * must not be trusted to assert.
   */
  adminRow?: InquiryAdminRow | null;
  /** The client's newest email, when it is theirs. Used for stage detection. */
  latestClientMessage?: string | null;
  examplePool?: ApprovedExample[];
  now?: Date;
};

export function buildEmailContext(input: BuildEmailContextInput): EmailContext {
  const { inquiry, messages, availability, threadLoaded } = input;
  const now = input.now ?? new Date();
  const warnings: ContextWarning[] = [];

  // The message is consulted too: the form's "Other" option hides real
  // proposals, graduations, and engagements.
  const classification = classifySession(inquiry.sessionType, inquiry.message);
  const playbook = classification.key;
  if (!playbook) {
    warnings.push({
      code: "session_type_unknown",
      severity: "medium",
      message: "Session type could not be identified, so no rate card applies. Check the price before sending.",
    });
  } else if (classification.ambiguous) {
    // Two unrelated kinds of session asked for in one message. Picking one
    // silently is how a wrong rate gets quoted confidently.
    warnings.push({
      code: "session_type_ambiguous",
      severity: "medium",
      message: `They describe both a ${playbook} and a ${classification.alternative} session. The draft treats it as ${playbook}. Check that is the one they want before quoting.`,
    });
  }

  // ── Availability ────────────────────────────────────────────────────────
  const requestedIso = normalizeDateInMind(inquiry.dateInMind);
  let requestedDateStatus: EmailContext["availability"]["requestedDateStatus"] = null;

  if (!availability) {
    warnings.push({
      code: "availability_unverified",
      severity: "high",
      message: "Availability could not be loaded. The draft will not offer any dates.",
    });
  } else if (requestedIso) {
    if (availability.available.some((d) => d.date === requestedIso)) requestedDateStatus = "available";
    else if (availability.booked.some((d) => d.date === requestedIso)) requestedDateStatus = "booked";
    else if (availability.onHold.some((d) => d.date === requestedIso)) requestedDateStatus = "on_hold";
    else requestedDateStatus = "unknown";

    if (requestedDateStatus === "booked" || requestedDateStatus === "on_hold") {
      warnings.push({
        code: "requested_date_unavailable",
        severity: "medium",
        message: `The date they asked for (${inquiry.dateInMind}) is ${requestedDateStatus === "booked" ? "booked" : "on hold"}. The draft offers alternatives instead.`,
      });
    }
  }

  // The availability table stores a status per DATE. It has no time windows, so
  // a date being open says nothing about sunset specifically.
  if (availability) {
    warnings.push({
      code: "availability_time_unverified",
      severity: "low",
      message: "Availability is tracked by date only. A specific time is a proposal, not a confirmed slot.",
    });
  }

  if (!threadLoaded) {
    warnings.push({
      code: "thread_not_loaded",
      severity: "high",
      message: "The Gmail thread could not be loaded, so the draft may repeat things already said.",
    });
  }

  // ── Pricing ─────────────────────────────────────────────────────────────
  const pricingFacts = buildPricingFacts({
    sessionType: inquiry.sessionType,
    message: inquiry.message,
    people: inquiry.people,
  });
  if (!pricingFacts.verified) {
    warnings.push({
      code: "pricing_unverified",
      severity: "high",
      message: pricingFacts.needsManualQuote ?? "No published rate matches this session. Set the price yourself.",
    });
  }

  // A shoot outside the city whose travel fee is not in the rate card, on top
  // of a session price that IS. That combination is where a confident-sounding
  // total goes out short by the travel fee.
  const travelFact = buildTravelFact(inquiry.school, inquiry.location, inquiry.message);
  if (travelFact?.includes("NOT in the rate card") && pricingFacts.verified) {
    warnings.push({
      code: "travel_unverified",
      severity: "medium",
      message: `This location is outside San Francisco and has no verified route yet, so the draft will not state a total. Route it with scripts/travel-route.mjs and add it to lib/travelFee.ts, or add the fee yourself before sending (${TRAVEL_RATE_LABEL}/round-trip mile, rounded up to $5, plus tolls).`,
    });
  }

  // ── Thread, administrative status, conversation stage ───────────────────
  const digest = buildThreadDigest(messages, now);

  // The record decides; the thread only softens. Without an inquiry row the
  // status is a guess off the prose, and the prompt is told so.
  const admin = buildAdminStatus(input.adminRow, digest);
  if (!admin.verified) {
    warnings.push({
      code: "booking_state_uncertain",
      severity: "medium",
      message: "No booking record was loaded, so invoice, contract and deposit state are unverified. The draft will not claim any of them happened.",
    });
  } else if (admin.invoicePromised || admin.contractPromised) {
    warnings.push({
      code: "booking_state_uncertain",
      severity: "low",
      message: "The thread promises an invoice or contract but the record shows none was sent. The draft will not imply it went out.",
    });
  }

  // Falls back to the newest message that is theirs, so stage detection still
  // works for callers that pass a thread without naming the latest message.
  const newestClientMessage = [...messages].reverse().find((m) => !m.fromMe)?.body ?? null;

  const stage = detectStage({
    digest,
    admin,
    latestClientMessage: input.latestClientMessage ?? newestClientMessage,
    inquiryMessage: inquiry.message,
    hasSessionDate: Boolean(admin.sessionDate),
  });

  // ── Golden hour ─────────────────────────────────────────────────────────
  // Only computed for a date that is actually offerable, so the draft can never
  // pair a precise sunset time with a date Chris cannot shoot.
  const goldenHourDate = requestedDateStatus === "available"
    ? requestedIso
    : availability?.available[0]?.date ?? null;

  const offerable = availability?.available ?? [];

  return {
    client: {
      name: inquiry.name,
      firstName: firstNameOf(inquiry.name),
      sessionType: inquiry.sessionType ?? null,
      playbook,
    },
    request: {
      dateInMind: inquiry.dateInMind ?? null,
      preferredTime: inquiry.preferredTime ?? null,
      location: inquiry.location ?? null,
      school: inquiry.school ?? null,
      people: inquiry.people != null ? String(inquiry.people) : null,
      rawMessage: inquiry.message,
    },
    availability: {
      verified: Boolean(availability),
      asOf: availability?.asOf ?? null,
      offerable,
      unavailable: [...(availability?.booked ?? []), ...(availability?.onHold ?? [])],
      timeVerified: false,
      requestedDateStatus,
    },
    pricing: { ...pricingFacts, travelFact },
    policy: buildPolicyFacts(),
    contact: buildContactFacts(),
    goldenHour: {
      window: goldenHourDate ? buildGoldenHourWindow(goldenHourDate) : null,
      caveat: goldenHourCaveat(`${inquiry.location ?? ""} ${inquiry.preferredTime ?? ""} ${inquiry.message}`),
    },
    thread: { digest, lines: renderThreadDigest(digest) },
    conversation: { stage, shape: stageShape(stage) },
    admin: { ...admin, lines: renderAdminStatus(admin) },
    examples: selectExamples(
      {
        sessionType: playbook,
        scenarios: pickScenarios(stage, digest, requestedDateStatus, offerable.length > 0),
        tags: pickTags(inquiry),
      },
      input.examplePool,
    ),
    warnings,
  };
}
