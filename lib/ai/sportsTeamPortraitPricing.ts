// ─────────────────────────────────────────────────────────────────────────────
// The approved eight-person standardized sports senior/team portrait offer.
//
// This is the ONLY source for these figures. It is deliberately not part of
// PRICING_CATALOG.graduation and never passes through graduationSessionPrice:
// eight ordinary graduates are $250 each with a 90-minute minimum, and this
// offer is a separate, narrowly scoped rate that applies to exactly one shape
// of request. Nothing here scales to another headcount.
//
// The module owns four things, so every surface agrees:
//   1. the primitive approved inputs and the totals derived from them
//   2. eligibility, read from the inquiry and a bounded inbound thread window
//   3. the verified pricing facts the prompt and the validator share
//   4. the semantic per-person and completeness checks the price check reuses
//
// Travel, tax, retainer, turnaround, venue, equipment and delivery were not
// approved for this offer, so none of them are stated here. Travel keeps the
// existing location-aware resolver, and the session totals are totals BEFORE
// any separately applicable travel fee.
// ─────────────────────────────────────────────────────────────────────────────

import type { PricingFacts } from "./businessFacts";
import type { ThreadMessage } from "./threadDigest";

export const SPORTS_TEAM_PORTRAIT_PLAYBOOK = "sports_team_portrait" as const;

function deepFreeze<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    const nested = value[key];
    if (nested && typeof nested === "object") deepFreeze(nested);
  }
  return Object.freeze(value);
}

/** Approved primitives only. Totals and image sums are derived, never stored. */
export const EIGHT_PERSON_SPORTS_SENIOR_OFFER = deepFreeze({
  headcount: 8,
  options: {
    thirtyMinutes: { durationMinutes: 30, perPerson: 100 },
    sixtyMinutes: { durationMinutes: 60, perPerson: 150 },
  },
  deliverables: {
    headshotsPerPerson: 2,
    fullBodyPerPerson: 3,
  },
  recommendedOption: "sixtyMinutes",
} as const);

export type SportsTeamOptionKey = keyof typeof EIGHT_PERSON_SPORTS_SENIOR_OFFER.options;

export type SportsTeamOption = {
  key: SportsTeamOptionKey;
  durationMinutes: number;
  perPerson: number;
  total: number;
};

export type SportsTeamDeliverables = {
  perPerson: number;
  headshotsPerPerson: number;
  fullBodyPerPerson: number;
  total: number;
};

export function sportsTeamOfferOptions(): SportsTeamOption[] {
  const { headcount, options } = EIGHT_PERSON_SPORTS_SENIOR_OFFER;
  return (Object.keys(options) as SportsTeamOptionKey[]).map((key) => ({
    key,
    durationMinutes: options[key].durationMinutes,
    perPerson: options[key].perPerson,
    total: headcount * options[key].perPerson,
  }));
}

export function sportsTeamDeliverables(): SportsTeamDeliverables {
  const { headcount, deliverables } = EIGHT_PERSON_SPORTS_SENIOR_OFFER;
  const perPerson = deliverables.headshotsPerPerson + deliverables.fullBodyPerPerson;
  return {
    perPerson,
    headshotsPerPerson: deliverables.headshotsPerPerson,
    fullBodyPerPerson: deliverables.fullBodyPerPerson,
    total: headcount * perPerson,
  };
}

export type ResolvedSportsTeamPortraitOffer = {
  playbook: typeof SPORTS_TEAM_PORTRAIT_PLAYBOOK;
  headcount: number;
  options: SportsTeamOption[];
  deliverables: SportsTeamDeliverables;
  recommendedDurationMinutes: number;
  /**
   * True when this reply is the client's first quote, so the whole two-option
   * offer must reach them. False once Chris has already quoted it: a later
   * confirmation or logistics reply is not required to restate it.
   */
  firstQuote: boolean;
};

/** The canonical resolved profile; also used for a restore that has already been verified. */
export function resolvedSportsTeamPortraitOffer(firstQuote = true): ResolvedSportsTeamPortraitOffer {
  const { headcount, options, recommendedOption } = EIGHT_PERSON_SPORTS_SENIOR_OFFER;
  return {
    playbook: SPORTS_TEAM_PORTRAIT_PLAYBOOK,
    headcount,
    options: sportsTeamOfferOptions(),
    deliverables: sportsTeamDeliverables(),
    recommendedDurationMinutes: options[recommendedOption].durationMinutes,
    firstQuote,
  };
}

// ── Prior client-specific quotes ────────────────────────────────────────────

export type PriorSessionQuote =
  | { kind: "none" }
  /** Chris, or the admin, already priced this client's session. */
  | { kind: "authoritative"; amounts: number[] }
  /** Chris wrote an amount whose role cannot be read; nothing may re-price over it. */
  | { kind: "ambiguous"; amounts: number[] };

const MONEY_FIGURE = /\$\s?([\d,]+(?:\.\d{2})?)/g;
const SESSION_ROLE = /\b(?:session|package|rate|total|per person|per player|per athlete|per head|per graduate|per grad|each|apiece|for the (?:group|team|hour|shoot)|minutes?|hours?|hr)\b/i;
const INCIDENTAL_ROLE = /\b(?:travel|mileage|toll|outfit|deposit|retainer|balance|add[- ]?on|second location|extra location|champagne|expedited|72[- ]hour|rush|gallery delivery|proof)\b/i;

function roleOf(window: string): "session" | "incidental" | "unknown" {
  if (INCIDENTAL_ROLE.test(window)) return "incidental";
  if (SESSION_ROLE.test(window)) return "session";
  return "unknown";
}

/**
 * What an outbound dollar figure was attached to.
 *
 * The words after the figure decide first ("$75 travel fee", "$900 for the
 * session"); only when they say nothing do the words before it count ("the
 * session is $900"). Both windows stop at the next figure so "$425 for the
 * session, plus a $75 travel fee" reads as two roles, not one.
 */
function classifyFigure(body: string, index: number, length: number): "session" | "incidental" | "unknown" {
  const after = body.slice(index + length).split(/\$|[.!?\n]/)[0].slice(0, 60);
  const afterRole = roleOf(after);
  if (afterRole !== "unknown") return afterRole;
  const before = body.slice(Math.max(0, index - 45), index).split(/\$|[.!?\n]/).pop() ?? "";
  return roleOf(before);
}

/**
 * Whether this client already has a session price, from Chris's own emails
 * or from an admin confirmation. Travel fees, add-ons and deposits are not
 * session prices and never count. An amount that cannot be classified is
 * reported as ambiguous so the caller fails closed instead of guessing.
 */
export function resolvePriorSessionQuote(
  messages: readonly ThreadMessage[],
  confirmedPrices: readonly number[],
): PriorSessionQuote {
  const authoritative = new Set<number>(confirmedPrices.filter((p) => Number.isFinite(p) && p > 0));
  const ambiguous = new Set<number>();

  for (const message of messages) {
    if (!message.fromMe) continue;
    for (const match of message.body.matchAll(MONEY_FIGURE)) {
      const amount = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const role = classifyFigure(message.body, match.index ?? 0, match[0].length);
      if (role === "session") authoritative.add(amount);
      else if (role === "unknown") ambiguous.add(amount);
    }
  }

  if (authoritative.size) return { kind: "authoritative", amounts: [...authoritative] };
  if (ambiguous.size) return { kind: "ambiguous", amounts: [...ambiguous] };
  return { kind: "none" };
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export type SportsTeamPortraitResolverInput = {
  sessionType?: string | null;
  /** The stored inquiry message: a complete source that can resolve on its own. */
  inquiryMessage: string;
  people?: string | number | null;
  /** The client's newest email, when it is theirs. */
  latestClientMessage?: string | null;
  /** The most recent INBOUND client messages, oldest first. Never Chris's prose. */
  recentInboundClientMessages?: readonly string[];
  /** False when Gmail history is snippet-only or failed to load. */
  threadLoaded: boolean;
  priorSessionQuote?: PriorSessionQuote;
  /** The verified travel fee for the shoot location, so an earlier all-in quote still reads as this offer. */
  verifiedTravelFee?: number | null;
};

export type SportsTeamPortraitResolution =
  | { status: "resolved"; offer: ResolvedSportsTeamPortraitOffer }
  | { status: "ineligible" }
  | { status: "superseded"; amounts: number[] }
  | { status: "ambiguous_prior_quote"; amounts: number[] };

/** How many inbound messages may connect a "how much?" to the earlier scope. */
const INBOUND_WINDOW = 4;

const EIGHT = String.raw`(?:8|eight)`;
const PERSON_NOUN = String.raw`(?:people|persons|seniors|senior athletes|athletes|players|students|participants|graduates|grads|guys|girls|kids|of us|of them|team members|teammates)`;

/** Phrases that tie sports or athlete context to the portrait session. */
const SPORTS_CONTEXT = [
  /\bsports?[- ](?:senior|team)[- ](?:portrait|portraits|photo|photos|picture|pictures|shoot|session|sessions)\b/i,
  /\bsenior[- ]athletes?\b/i,
  /\bathletes?[- ](?:portrait|portraits|photo|photos|picture|pictures|shoot|session)\b/i,
  /\b(?:sports?|athletic)[- ]team[- ](?:portrait|portraits|photo|photos|picture|pictures|shoot|session)\b/i,
  /\bteam[- ](?:portrait|portraits|photo|photos|picture|pictures)\b[^.!?\n]{0,40}\b(?:senior|athlete)/i,
  /\b(?:senior|athlete)s?\b[^.!?\n]{0,40}\bteam[- ](?:portrait|portraits|photo|photos|picture|pictures)\b/i,
];

/**
 * A current question about money. Duration words alone are not one: "let's do
 * the one hour option, can you send the invoice?" is an acceptance, and
 * "I'm in charge of organizing" is not a price question.
 */
const PRICING_INTENT = /\b(?:price|prices|pricing|cost|costs|rate|rates|how much|quote|charges?(?!\s+of\b)|fee for the session)\b/i;

/**
 * Requests this offer must never answer, however much sports wording they
 * carry: anything that mentions graduating keeps the graduation rate card, and
 * a headshot event for a club, class, team or company stays a manual quote.
 */
const VETO = [
  /\bgraduat(?:e|es|ed|ing|ion)\b/i,
  /\bgrad (?:photo|photos|photoshoot|shoot|session|portraits|pictures|pics)\b/i,
  /\bcap and gown\b/i,
  /\bheadshot (?:event|day|drive)\b/i,
  /\bgroup headshots?\b/i,
  /\bheadshots? for (?:my|our) (?:classmates|club|team|staff|students|members|organization|company|association|cohort)\b/i,
  /\borganiz(?:e|ing) a headshot\b/i,
];

/** Headcount evidence that is explicitly not an exact eight. */
const NOT_EXACT_EIGHT = [
  new RegExp(String.raw`\b${EIGHT}\s*\+`, "i"),
  new RegExp(String.raw`\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s+${PERSON_NOUN}\b`, "i"),
  new RegExp(String.raw`\b(?:\d{1,2}|eight|seven|nine)\s+or\s+(?:\d{1,2}|eight|seven|nine)\s+${PERSON_NOUN}\b`, "i"),
  new RegExp(String.raw`\b(?:around|about|roughly|approximately|maybe|up to|at least|at most|close to)\s+${EIGHT}\b`, "i"),
  new RegExp(String.raw`\b${EIGHT}\s+or so\b`, "i"),
  new RegExp(String.raw`\b${EIGHT}\s+(?:plus|and)\s+(?:a few|some|more|\d)`, "i"),
  // "8 seniors plus the coaches": more people than the eight counted.
  new RegExp(String.raw`\b${EIGHT}\s+${PERSON_NOUN}[^.!?\n]{0,12}\b(?:plus|along with|as well as|and also)\b`, "i"),
];

/** The structured headcount field, as the form or the admin wrote it. */
const FIELD_EIGHT = /^8(?:\s+(?:people|persons|athletes|seniors|players|students|participants))?$/i;

/** A count attached to a person noun, as a number. "team of eight" included. */
function headcountsIn(text: string): number[] {
  const counts: number[] = [];
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const toCount = (raw: string) => words[raw.toLowerCase()] ?? Number(raw);
  // "grade 8 students" and "#8" are not counts of people.
  for (const m of text.matchAll(new RegExp(String.raw`(?<!grade\s)(?<!#)\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:[- ]person)?\s+${PERSON_NOUN}\b`, "gi"))) {
    counts.push(toCount(m[1]));
  }
  for (const m of text.matchAll(/\b(?:team|group|roster|party) of (\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi)) {
    counts.push(toCount(m[1]));
  }
  return counts.filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Exactly eight, or null.
 *
 * The structured field decides when it is an exact "8"; prose may only
 * confirm it. Prose alone decides only when every count it names is eight.
 * "8+", ranges, approximations, dates, grades, jersey numbers and "8x10" are
 * not headcounts and never resolve.
 */
function exactEight(people: string | number | null | undefined, texts: string[]): boolean {
  const joined = texts.join("\n");
  if (NOT_EXACT_EIGHT.some((pattern) => pattern.test(joined))) return false;

  const field = people == null ? "" : String(people).trim();
  const inProse = headcountsIn(joined);
  if (inProse.some((n) => n !== EIGHT_PERSON_SPORTS_SENIOR_OFFER.headcount)) return false;

  if (field) return FIELD_EIGHT.test(field);
  return inProse.length > 0;
}

/**
 * Deliverables the client asked for that the approved profile does not give.
 * Absent counts are fine (the profile supplies them); a different count, or
 * open-ended coverage, is not something to answer with a fixed offer.
 */
function contradictsDeliverables(text: string): boolean {
  const approved = sportsTeamDeliverables();
  const perPerson = text.match(/\b(\d{1,3})\s+(?:edited\s+)?(?:images|photos|pictures|portraits)\s+(?:per|for each|each|a)\s+(?:person|player|athlete|senior|student|head|participant)\b/i)
    ?? text.match(/\b(?:everyone|everybody|each (?:person|athlete|player|senior|student|one)|every (?:person|athlete|player|senior|student)|per person)\s+(?:gets?|receives?|needs?|wants?|should get)\s+(\d{1,3})\s+(?:edited\s+)?(?:images|photos|pictures|portraits)\b/i);
  if (perPerson && Number(perPerson[1]) !== approved.perPerson) return true;
  const headshots = text.match(/\b(\d{1,3})\s+headshots?\b/i);
  if (headshots && Number(headshots[1]) !== approved.headshotsPerPerson) return true;
  const fullBody = text.match(/\b(\d{1,3})\s+full[- ]body\b/i);
  if (fullBody && Number(fullBody[1]) !== approved.fullBodyPerPerson) return true;
  const total = text.match(/\b(\d{1,3})\s+(?:edited\s+)?(?:images|photos|pictures)\s+(?:in )?total\b|\btotal of (\d{1,3})\s+(?:edited\s+)?(?:images|photos|pictures)\b/i);
  if (total && Number(total[1] ?? total[2]) !== approved.total) return true;
  return /\b(?:all|every|unlimited|raw|unedited)\b[^.!?\n]{0,30}\b(?:photos|images|pictures|files|shots)\b/i.test(text);
}

/**
 * Whether a prior quote is the standardized offer itself (either total, with
 * or without the verified travel fee, or either per-person figure), so
 * nothing would be replaced by applying it again.
 */
function matchesOffer(amounts: number[], verifiedTravelFee: number | null): boolean {
  const known = new Set<number>(sportsTeamOfferOptions().flatMap((o) => [
    o.total, o.perPerson, ...(verifiedTravelFee ? [o.total + verifiedTravelFee] : []),
  ]));
  return amounts.length > 0 && amounts.every((a) => known.has(a));
}

/**
 * Resolves the special profile, or says why not.
 *
 * Eligibility needs exactly eight participants and sports/athlete context tied
 * to the portrait session, plus either a current pricing question or an
 * earlier quote from Chris that IS this offer (then it stays in force for the
 * rest of the thread, and the reply is not a first quote). The stored inquiry
 * is a complete source on its own. Gmail evidence counts only when the thread
 * genuinely loaded, and only inbound client messages are read; Chris's
 * outgoing prose is never evidence of what the client asked for.
 */
export function resolveSportsTeamPortraitOffer(input: SportsTeamPortraitResolverInput): SportsTeamPortraitResolution {
  const inquiry = `${input.sessionType ?? ""}\n${input.inquiryMessage ?? ""}`;
  const threadTexts = input.threadLoaded
    ? [...(input.recentInboundClientMessages ?? []).slice(-INBOUND_WINDOW), input.latestClientMessage ?? ""].filter(Boolean)
    : [];
  const evidence = [inquiry, ...threadTexts];
  const joined = evidence.join("\n");

  if (VETO.some((pattern) => pattern.test(joined))) return { status: "ineligible" };
  if (!SPORTS_CONTEXT.some((pattern) => pattern.test(joined))) return { status: "ineligible" };
  if (!exactEight(input.people, evidence)) return { status: "ineligible" };
  if (contradictsDeliverables(joined)) return { status: "ineligible" };

  const prior = input.priorSessionQuote ?? { kind: "none" };
  if (prior.kind === "ambiguous") return { status: "ambiguous_prior_quote", amounts: prior.amounts };
  if (prior.kind === "authoritative") {
    if (matchesOffer(prior.amounts, input.verifiedTravelFee ?? null)) {
      return { status: "resolved", offer: resolvedSportsTeamPortraitOffer(false) };
    }
    return { status: "superseded", amounts: prior.amounts };
  }

  const latest = (input.latestClientMessage ?? "").trim();
  const asksPrice = latest ? PRICING_INTENT.test(latest) : PRICING_INTENT.test(input.inquiryMessage ?? "");
  if (!asksPrice) return { status: "ineligible" };

  return { status: "resolved", offer: resolvedSportsTeamPortraitOffer(true) };
}

// ── Verified facts ──────────────────────────────────────────────────────────

const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;

/**
 * The pricing facts for the resolved profile. Totals are package bases; the
 * per-person figures are informational and are never summed with anything.
 * The travel fact is rendered separately by the context, from the existing
 * resolver, so these lines say only that the totals come before it.
 */
export function buildSportsTeamPortraitFacts(offer: ResolvedSportsTeamPortraitOffer): PricingFacts & { informationalPrices: number[] } {
  const [thirty, sixty] = offer.options;
  const d = offer.deliverables;
  const lines = [
    `Custom standardized sports-team portrait rate for exactly ${offer.headcount} participants, separate from the regular graduation group pricing (do not mention per-graduate rates, the group minimum, or 25+ images per person). Two options: ${thirty.durationMinutes} minutes is ${money(thirty.total)} total (${money(thirty.perPerson)} per person), and ${sixty.durationMinutes} minutes is ${money(sixty.total)} total (${money(sixty.perPerson)} per person). Give both options with the total and the per-person figure for each.`,
    `Each participant receives ${d.perPerson} edited images: ${d.headshotsPerPerson} headshots and ${d.fullBodyPerPerson} full-body portraits. The group receives ${d.total} edited images total. Say exactly "${d.perPerson} edited images" and "${d.total} edited images", with no plus sign.`,
    `Strongly recommend ${sixty.durationMinutes} minutes: eight participants need individual posing and both headshot and full-body coverage, and ${thirty.durationMinutes} minutes requires a streamlined setup and will feel rushed.`,
    `These are session totals before any separately applicable travel fee. If a verified travel fee is given below, add it once to EACH option's total and give each all-in figure; if travel is outside the city but unverified, say the travel amount still needs confirmation and give no all-in total. Never call the session totals all-in when travel is pending.`,
    `This rate applies only to this exact ${offer.headcount}-person setup. Do not scale it to any other headcount.`,
  ];
  return {
    verified: true,
    lines,
    basePrices: offer.options.map((o) => o.total),
    addOnPrices: [],
    informationalPrices: offer.options.map((o) => o.perPerson),
    needsManualQuote: null,
  };
}

