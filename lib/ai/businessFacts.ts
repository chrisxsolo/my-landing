// ─────────────────────────────────────────────────────────────────────────────
// Verified business facts for one inquiry, rendered from the rate card.
//
// The old prompt took pricing from hand-written vault prose ("02 Pricing"), so
// the typed catalog that actually drives the website estimator never reached
// the model. This module reads lib/pricingCatalog.ts — the same source the
// estimator and the contract generator use — and emits only the slice that
// matches the session type.
//
// Nothing here invents a number. Where the catalog says a fee is undefined
// (travel to an unlisted location) the output says so in words, so the model
// has a fact to relay rather than a gap to fill.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PRICING_CATALOG,
  BOOKING_POLICY,
  calculatePaymentSchedule,
} from "@/lib/pricingCatalog";
import { resolvePlaybookKey } from "./sessionClassifier";

export type PricingFacts = {
  verified: boolean;
  lines: string[];
  /**
   * Session prices a quote can legitimately be built on. Machine-readable so
   * the validator can check a stated price without regexing this module's own
   * prose back out of the prompt.
   */
  basePrices: number[];
  /** Add-on prices, only valid on top of a base. */
  addOnPrices: number[];
  /** Set when the client's situation needs Chris to price it by hand. */
  needsManualQuote: string | null;
};

function money(amount: number): string {
  return `$${amount}`;
}

function graduationFacts(peopleCount: number): PricingFacts {
  const grad = PRICING_CATALOG.graduation;
  const lines: string[] = [];

  if (peopleCount <= 1) {
    lines.push(`Graduation session: ${money(grad.baseHourlyRate)} per hour, ${grad.standardMinimumImages}+ edited images, ${grad.durationRules.standardMinutes}-minute standard session.`);
    lines.push(`A longer solo session is priced by the hour: ${grad.durationRules.allowedMinutes.join(", ")} minutes are the lengths offered.`);
  } else {
    const perPerson = peopleCount >= 6
      ? grad.groupRates[6]
      : grad.groupRates[peopleCount as 2 | 3 | 4 | 5] ?? grad.groupRates[6];
    const total = perPerson * peopleCount;
    lines.push(`Group graduation rate for ${peopleCount} graduates: ${money(perPerson)} per person, ${money(total)} total, ${grad.groupMinimumImagesPerPerson}+ edited images per person.`);
    if (peopleCount >= grad.durationRules.groupMinimumSize) {
      lines.push(`Groups of ${grad.durationRules.groupMinimumSize} or more need at least ${grad.durationRules.groupMinimumMinutes} minutes, and that length is included in the per-person rate.`);
    } else {
      // Spelled out because the gap was expensive. A real inquiry asked for
      // "2 people for 1.5hours", the facts said nothing about what a longer
      // group session costs, and the model spent its whole output budget
      // reasoning about it and returned a truncated draft.
      lines.push(`The group rate covers the standard ${grad.durationRules.standardMinutes}-minute session. A longer booking adds the extra 30 minutes add-on at ${money(grad.addOns.extra30Minutes.price)} per 30 minutes, so ${peopleCount} graduates for 90 minutes is ${money(total)} plus ${money(grad.addOns.extra30Minutes.price)}, ${money(total + grad.addOns.extra30Minutes.price)} total.`);
    }
  }

  lines.push(
    `Add-ons: extra outfit ${money(grad.addOns.extraOutfit.price)}, second nearby location ${money(grad.addOns.secondLocation.price)}, extra 30 minutes ${money(grad.addOns.extra30Minutes.price)}, 72-hour gallery ${money(grad.addOns.expedited.price)}, champagne setup ${money(grad.addOns.champagne.price)}.`,
  );

  const perPerson = peopleCount <= 1
    ? grad.baseHourlyRate
    : peopleCount >= 6
      ? grad.groupRates[6]
      : grad.groupRates[peopleCount as 2 | 3 | 4 | 5] ?? grad.groupRates[6];

  return {
    verified: true,
    lines,
    // Both the per-person rate and the group total are quotable figures, and a
    // longer booking is a multiple of the hourly rate.
    basePrices: peopleCount <= 1
      ? [grad.baseHourlyRate, grad.baseHourlyRate * 1.5, grad.baseHourlyRate * 2]
      : [perPerson, perPerson * peopleCount],
    addOnPrices: [
      grad.addOns.extraOutfit.price, grad.addOns.secondLocation.price,
      grad.addOns.extra30Minutes.price, grad.addOns.expedited.price,
      grad.addOns.champagne.price,
    ],
    needsManualQuote: null,
  };
}

function couplesFacts(packageKey: keyof typeof PRICING_CATALOG.couples.packages): PricingFacts {
  const couples = PRICING_CATALOG.couples;
  const pkg = couples.packages[packageKey];
  const minimumImages = "minimumImages" in pkg ? pkg.minimumImages : null;

  const lines = [
    `${pkg.label}: ${money(pkg.price)}, ${pkg.durationLabel}${minimumImages ? `, ${minimumImages}+ edited images` : ""}.`,
    `Add-ons: extra location ${money(couples.addOns.extraLocation.price)}, extra outfit ${money(couples.addOns.extraOutfit.price)}, extra 30 minutes ${money(couples.addOns.extra30Minutes.price)}, 72-hour gallery ${money(couples.addOns.expedited.price)}, rush preview of 5 images in 48 hours ${money(couples.addOns.rushPreview.price)}.`,
  ];
  return {
    verified: true,
    lines,
    basePrices: [pkg.price],
    addOnPrices: [
      couples.addOns.extraLocation.price, couples.addOns.extraOutfit.price,
      couples.addOns.extra30Minutes.price, couples.addOns.expedited.price,
      couples.addOns.rushPreview.price, couples.addOns.proofingGallery.price,
    ],
    needsManualQuote: null,
  };
}

function familyFacts(peopleCount: number): PricingFacts {
  const families = PRICING_CATALOG.families;
  const lines = [
    `${families.packages.standard.label}: ${money(families.packages.standard.price)}, ${families.packages.standard.durationMinutes}-minute session, ${families.packages.standard.minimumImages}+ edited images.`,
    `${families.packages.extended.label}: ${money(families.packages.extended.price)}, ${families.packages.extended.durationMinutes}-minute session, ${families.packages.extended.minimumImages}+ edited images.`,
    `Add-ons: additional nearby location ${families.addOns.extraLocation.displayPrice}, extended family members ${families.addOns.extendedFamily.displayPrice}, additional time ${families.addOns.extra30Minutes.displayPrice}, 72-hour gallery ${families.addOns.expedited.displayPrice}.`,
  ];
  // The catalog prices extended family members as a range, so a large group is
  // a judgement call rather than a lookup.
  // Worded without asserting a headcount: the count is summed from phrases
  // like "8 adults, 3 children and a four month old", which is reliable enough
  // to know the group is large and not reliable enough to quote back at them.
  const needsManualQuote = peopleCount > 8
    ? "This is a larger group than the standard family session covers. Confirm the price by hand before quoting, and do not state a total."
    : null;
  return {
    verified: true,
    lines,
    basePrices: [families.packages.standard.price, families.packages.extended.price],
    // These are display ranges in the catalog, so the low and high ends of each
    // are both legitimate.
    addOnPrices: [125, 150, 50, 75, 100],
    needsManualQuote,
  };
}

/**
 * Event coverage, priced by length.
 *
 * The catalog has three tiers with different hourly rates and minimums, so an
 * hourly figure alone is misleading — the minimum is the number that decides
 * what they pay.
 */
function eventFacts(): PricingFacts {
  const events = PRICING_CATALOG.events;
  const { smallEvent, mediumEvent, largeEvent } = events;

  const lines = [
    `Short event coverage: ${money(smallEvent.hourlyRate)} per hour with a ${smallEvent.minimumHours}-hour minimum, ${smallEvent.minimumImages}+ edited images, ${smallEvent.turnaroundLabel}.`,
    `Longer events of ${mediumEvent.minimumHours} hours or more: ${money(mediumEvent.hourlyRate)} per hour.`,
    `Half day (${largeEvent.halfDayHours} hours): ${money(largeEvent.halfDayPrice)}. Full day starts at ${money(largeEvent.fullDayStartingPrice)}.`,
    `Add-ons: second shooter ${events.addOns.secondShooter.displayPrice}, expedited delivery ${events.addOns.expedited.displayPrice}.`,
    `Travel beyond ${events.includedTravelMiles} miles of San Francisco: ${events.addOns.travel.displayPrice}.`,
  ];

  return {
    verified: true,
    lines,
    // Quotable totals: the minimum booking at each tier, plus the day rates.
    basePrices: [
      smallEvent.hourlyRate * smallEvent.minimumHours,
      mediumEvent.hourlyRate * mediumEvent.minimumHours,
      largeEvent.halfDayPrice,
      largeEvent.fullDayStartingPrice,
      smallEvent.hourlyRate,
      mediumEvent.hourlyRate,
    ],
    addOnPrices: [],
    needsManualQuote:
      "Event pricing depends on hours, venue, and travel. Confirm the final figure yourself before promising a total.",
  };
}

/**
 * Headshot and individual-portrait sessions are not in the rate card. Saying
 * so is the correct output: it makes the validator flag any price the model
 * invents, and it tells Chris the quote needs him.
 */
function unpricedSessionFacts(label: string): PricingFacts {
  return {
    verified: false,
    lines: [`There is no published rate for ${label} sessions in the rate card.`],
    basePrices: [],
    addOnPrices: [],
    needsManualQuote: `${label} sessions are not in the rate card. Do not quote a price — ask what they need, or send the price yourself.`,
  };
}

const WORD_NUMBERS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const PERSON_NOUN = "people|persons|of us|graduates|grads|kids|children|adults|babies|baby|toddlers|students|guests";

/**
 * Headcount from the message, summing every group the client lists.
 *
 * Taking only the first match undercounted badly: "8 adults, 3 children ages
 * 10-5 and 1 four month old baby" is twelve people, and reading it as eight
 * kept the family session below the threshold that asks Chris to price a large
 * group by hand.
 */
function peopleInMessage(message: string): number {
  const pattern = new RegExp(`\\b(\\d{1,2})\\s*(?:${PERSON_NOUN})\\b`, "gi");
  let total = 0;
  for (const match of message.matchAll(pattern)) {
    const count = Number(match[1]);
    // A stray age ("ages 10-5") would inflate the total; a party of more than
    // 20 in one clause is far likelier to be a typo than a real booking.
    if (Number.isFinite(count) && count > 0 && count <= 20) total += count;
  }
  if (total) return total;

  const worded = message.toLowerCase().match(
    new RegExp(`\\b(?:family|group|party) of (${Object.keys(WORD_NUMBERS).join("|")})\\b`),
  );
  if (worded) return WORD_NUMBERS[worded[1]];

  const digits = message.match(/\b(?:family|group|party) of (\d{1,2})\b/i);
  return digits ? Number(digits[1]) : 0;
}

/**
 * An organised shoot for a club, class, or company.
 *
 * Kept off the session card on purpose. One of these arrived filed as a
 * graduation portrait ("I'm organising a headshot event so my classmates
 * can..."), resolved to the group graduation rate, and would have been quoted
 * over $1,100 against the $600 flat rate Chris actually agreed for it. There
 * is no published group rate, so the only correct output is that there isn't
 * one.
 */
function groupBookingFacts(): PricingFacts {
  return {
    verified: false,
    lines: [
      "There is no published rate for a group headshot booking for a club, class, or company.",
      "Per-person and per-hour session rates do not apply to a group booking like this.",
    ],
    basePrices: [],
    addOnPrices: [],
    needsManualQuote:
      "Group headshot bookings are quoted by hand every time. Do not quote any price, including a per-person rate. Find out the headcount, the time window, and the venue, and say the quote is coming.",
  };
}

function parsePeople(value: string | number | null | undefined, message: string): number {
  const fromMessage = peopleInMessage(message);
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(Math.round(value), fromMessage);
  }
  const field = String(value ?? "").match(/\d+/);
  // "5+" in the form means five OR MORE, so a larger count in the message wins.
  if (field) return Math.max(1, Number(field[0]), fromMessage);
  return fromMessage > 0 ? fromMessage : 1;
}

/**
 * Picks the couples package by the length the client asked for.
 *
 * It used to re-detect proposal and engagement here with its own copy of the
 * type patterns, which is how a correctly classified couples session still got
 * priced as a proposal: "I plan to do my proposal shortly before and I would
 * just like to do a couples session after" matched /propos/ and was quoted
 * $750 for a $350 mini, against a client who had said what they could afford.
 *
 * Only reached when the classifier has already settled on couples, so
 * proposal, engagement, and elopement are out of scope by construction and
 * duration is the only open question.
 */
function detectCouplesPackage(
  sessionType: string,
  message: string,
): keyof typeof PRICING_CATALOG.couples.packages {
  const text = `${sessionType} ${message}`.toLowerCase();
  if (/signature|90 ?min|90-minute|1\.5 ?hour/.test(text)) return "signature";
  if (/\bmini\b|30 ?min|30-minute|half (?:an )?hour/.test(text)) return "mini";
  return "1hr";
}

export type BusinessFactsInput = {
  sessionType: string | null | undefined;
  message: string;
  people?: string | number | null;
};

export function buildPricingFacts(input: BusinessFactsInput): PricingFacts {
  const sessionType = input.sessionType ?? "";
  const message = input.message ?? "";
  const playbook = resolvePlaybookKey(sessionType, message);
  const people = parsePeople(input.people, message);

  switch (playbook) {
    case "graduation": return graduationFacts(people);
    case "proposal":   return couplesFacts("proposal");
    case "engagement": return couplesFacts("engagement");
    case "couples":    return couplesFacts(detectCouplesPackage(sessionType, message));
    case "family":     return familyFacts(people);
    case "event":      return eventFacts();
    case "headshot":   return unpricedSessionFacts("headshot");
    case "portrait":   return unpricedSessionFacts("individual portrait");
    case "elopement":  return unpricedSessionFacts("elopement");
    case "commercial": return unpricedSessionFacts("commercial or branding");
    case "headshot_event": return groupBookingFacts();
    default:
      return {
        verified: false,
        lines: ["Session type is not identified, so no rate applies yet."],
        basePrices: [],
        addOnPrices: [],
        needsManualQuote: "Session type is unclear. Ask what kind of session they want before quoting anything.",
      };
  }
}

/** Campuses the graduation rate card prices travel for. */
const CAMPUS_FEES: [RegExp, keyof typeof PRICING_CATALOG.graduation.travelFees][] = [
  [/sf ?state|san francisco state|sfsu/, "sf-state"],
  [/usf|university of san francisco/, "usf"],
  [/uc ?berkeley|berkeley|cal\b/, "uc-berkeley"],
  [/csueb|cal state east bay|east bay|hayward/, "csueb"],
  [/sjsu|san jose state/, "sjsu"],
  [/santa clara|scu/, "santa-clara"],
  [/stanford/, "stanford"],
  [/san francisco|\bsf\b/, "sf-other"],
];

/**
 * A location that names an actual campus, for the one case where a travel fee
 * can be read off a location. Tighter than CAMPUS_FEES on purpose: that list
 * matches a school FIELD, where a bare "east bay" does mean CSU East Bay.
 */
const NAMED_CAMPUSES: [RegExp, keyof typeof PRICING_CATALOG.graduation.travelFees][] = [
  [/\bcsueb\b|cal state east bay|california state university,? east bay/, "csueb"],
  [/\bsjsu\b|san jose state/, "sjsu"],
  [/santa clara university|\bscu\b/, "santa-clara"],
  [/stanford university|stanford campus/, "stanford"],
  [/uc ?berkeley|university of california,? berkeley|berkeley campus/, "uc-berkeley"],
];

function namedCampusFee(normalizedLocation: string): number | null {
  const fees = PRICING_CATALOG.graduation.travelFees;
  for (const [pattern, key] of NAMED_CAMPUSES) {
    if (!pattern.test(normalizedLocation)) continue;
    const fee = fees[key];
    return typeof fee === "number" ? fee : null;
  }
  return null;
}

/** Places that are plainly inside San Francisco, where no travel fee applies. */
const IN_SAN_FRANCISCO =
  /san francisco|\bsf\b|crissy|baker beach|lands end|palace of fine arts|golden gate park|dolores|presidio|sutro|twin peaks|city hall|legion of honor|ocean beach|marshall'?s beach|bernal|alamo square|fort point|mission district|stern grove|botanical garden/;

/**
 * Somewhere outside the city. Used only to decide whether travel needs
 * raising, never to derive an amount: the number is not in the rate card for
 * most of these, and guessing one is the expensive mistake.
 */
const OUTSIDE_SAN_FRANCISCO =
  /oakland|berkeley|alameda|richmond|san jose|santa clara|sunnyvale|palo alto|stanford|menlo park|woodside|filoli|redwood city|san mateo|burlingame|peninsula|half moon bay|pacifica|rockaway|daly city|marin|sausalito|tiburon|muir|point reyes|stinson|napa|sonoma|santa cruz|davenport|monterey|walnut creek|livermore|fremont|hayward|concord|dublin|pleasanton|gilroy|morgan hill|san rafael|novato|petaluma|vallejo|east bay|south bay|north bay|wine country/;

/** The first out-of-city place named in the message, if any. */
function placeInMessage(message: string): string {
  const match = message.toLowerCase().match(OUTSIDE_SAN_FRANCISCO);
  return match ? match[0] : "";
}

/**
 * Travel, as a verified fee, an explicit unknown, or nothing when the shoot is
 * in the city.
 *
 * Reads the LOCATION as well as the school, and prefers it. Two reasons, both
 * from real threads. Travel follows where the camera goes, not where the
 * client studies: Chris re-quoted a Santa Clara graduate who moved the shoot
 * to Filoli ("since the location would be changing from Santa Clara University
 * to Filoli, the travel fee would be updated accordingly"). And the fee used
 * to exist only for graduations, because it was keyed on `school` alone, so a
 * Point Reyes elopement, a Muir Woods proposal, and a pumpkin-patch family
 * session an hour south all produced no travel fact at all and the draft
 * quoted the bare session price.
 */
export function buildTravelFact(
  school: string | null | undefined,
  location?: string | null,
  message?: string | null,
): string | null {
  const campus = (school ?? "").trim();
  // Clients often name the place in the message and leave the field blank:
  // "if you could take photos anytime Friday ... at Rockaway Beach in
  // Pacifica". Used only as a last resort, and only to decide that travel
  // needs raising, never to pick an amount.
  const place = (location ?? "").trim() || (!campus ? placeInMessage(message ?? "") : "");
  if (!place && !campus) return null;

  const unknown = (subject: string) =>
    `The travel fee for ${subject} is NOT in the rate card and must be confirmed by hand. Do not state a travel fee, and do not state a session total that includes one. Say the travel fee depends on the exact location and that you'll confirm it.`;

  // ── The location decides, when they gave one: it is where the shoot is ──
  if (place) {
    const normalized = place.toLowerCase();
    // A campus fee applies only when the shoot is AT that campus, matched on
    // campus names rather than the looser school-field patterns: a couples
    // session somewhere in "East Bay" is not a CSU East Bay graduation, and
    // billing it that campus's $30 would be a guess.
    const fee = namedCampusFee(normalized);
    if (fee !== null) return `Travel fee for ${place}: ${money(fee)}.`;
    if (IN_SAN_FRANCISCO.test(normalized)) return `No travel fee for ${place}, it's in San Francisco.`;
    if (OUTSIDE_SAN_FRANCISCO.test(normalized)) return unknown(place);
    // The location told us nothing either way, so fall through to the school.
  }

  // ── Otherwise the school's campus, which the rate card does price ──
  if (campus) {
    const normalized = campus.toLowerCase();
    const fees = PRICING_CATALOG.graduation.travelFees;
    for (const [pattern, key] of CAMPUS_FEES) {
      if (!pattern.test(normalized)) continue;
      const fee = fees[key];
      if (fee === null) return `No travel fee for ${campus}, it's in San Francisco.`;
      if (typeof fee === "number") return `Travel fee for ${campus}: ${money(fee)}.`;
      break;
    }
    return unknown(campus);
  }
  return unknown(place);
}

/** Booking policy and delivery timelines, identical for every session. */
export function buildPolicyFacts(): string[] {
  return [
    `Booking: ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves the date. Contract signed ${BOOKING_POLICY.contractDeadline}. Remaining balance due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
    `Gallery delivery: ${PRICING_CATALOG.standardTurnaroundDays} days standard.`,
  ];
}

/** Retainer and balance for a settled total, for confirmation-stage replies. */
export function buildRetainerFact(total: number): string {
  const { retainer, remainingBalance } = calculatePaymentSchedule(total);
  return `On a ${money(total)} session the retainer is ${money(retainer)} and the remaining balance is ${money(remainingBalance)}.`;
}
