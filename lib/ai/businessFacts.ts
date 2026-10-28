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
  addOnPriceValues,
  calculatePaymentSchedule,
} from "@/lib/pricingCatalog";
import { graduationSessionPrice } from "@/lib/pricing";
import { resolvePlaybookKey } from "./sessionClassifier";
import { resolveTravel, type TravelResolution } from "@/lib/travelResolution";

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

/** "$350"; travel fees are whole dollars, but a figure with cents is still printed as such. */
function money(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function graduationFacts(peopleCount: number): PricingFacts {
  const grad = PRICING_CATALOG.graduation;
  const lines: string[] = [];

  if (peopleCount <= 1) {
    // Phrased the way Chris phrases it: "My graduation sessions at San Jose
    // State start at $350 for a 1-hour session". The catalog field is named
    // baseHourlyRate, and rendering that literally as "$350 per hour" made
    // the draft sound like it was selling time rather than a session.
    lines.push(`Graduation sessions START AT ${money(grad.baseHourlyRate)} for a ${grad.durationRules.standardMinutes}-minute session, ${grad.standardMinimumImages}+ edited images. Say "start at ${money(grad.baseHourlyRate)}" or "${money(grad.baseHourlyRate)} for a 1-hour session". Do NOT say "${money(grad.baseHourlyRate)} per hour" or "${money(grad.baseHourlyRate)}/hour".`);
    lines.push(`Longer sessions are available at ${grad.durationRules.allowedMinutes.join(", ")} minutes; ${money(grad.addOns.extra30Minutes.price)} for each extra 30 minutes.`);
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
      lines.push(`The group rate covers the standard ${grad.durationRules.standardMinutes}-minute session. A longer booking adds the extra 30 minutes add-on at ${money(grad.addOns.extra30Minutes.price)} per 30 minutes, so ${peopleCount} graduates for 90 minutes is ${money(total)} plus ${money(grad.addOns.extra30Minutes.price)}, ${money(graduationSessionPrice(peopleCount, 90))} total.`);
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
    // Both the per-person rate and the group total are quotable figures. A
    // single graduate's longer bookings are priced by the one duration rule in
    // lib/pricing.ts, the same one the public estimator shows.
    basePrices: peopleCount <= 1
      ? grad.durationRules.allowedMinutes.map((minutes) => graduationSessionPrice(1, minutes))
      : [perPerson, graduationSessionPrice(peopleCount)],
    addOnPrices: [
      grad.addOns.extraOutfit.price, grad.addOns.secondLocation.price,
      grad.addOns.extra30Minutes.price, grad.addOns.expedited.price,
      grad.addOns.champagne.price,
    ],
    needsManualQuote: null,
  };
}

function describePackage(key: keyof typeof PRICING_CATALOG.couples.packages): string {
  const pkg = PRICING_CATALOG.couples.packages[key];
  const minimumImages = "minimumImages" in pkg ? pkg.minimumImages : null;
  return `${pkg.label}: ${money(pkg.price)}, ${pkg.durationLabel}${minimumImages ? `, ${minimumImages}+ edited images` : ""}.`;
}

/**
 * The couples session card.
 *
 * `showAllPackages` exists because sending only the matched package let the
 * model conclude the others did not exist. A client who wrote "either looking
 * at standard or signature package" was told "I only offer that one package
 * right now", which is false and came from the facts block, not the model's
 * imagination. Proposal and engagement still ship alone: those have one rate
 * each, and widening the list there is how a $750 proposal gets quoted at
 * $350.
 */
function couplesFacts(
  packageKey: keyof typeof PRICING_CATALOG.couples.packages,
  showAllPackages = false,
): PricingFacts {
  const couples = PRICING_CATALOG.couples;
  const pkg = couples.packages[packageKey];

  const sessionKeys = ["mini", "1hr", "signature"] as const;
  const lines = showAllPackages
    ? [
      ...sessionKeys.map(describePackage),
      `Their wording points at the ${pkg.label}, but all three above are real options you may describe.`,
    ]
    : [describePackage(packageKey)];

  lines.push(
    `Add-ons: extra location ${money(couples.addOns.extraLocation.price)}, extra outfit ${money(couples.addOns.extraOutfit.price)}, extra 30 minutes ${money(couples.addOns.extra30Minutes.price)}, 72-hour gallery ${money(couples.addOns.expedited.price)}, rush preview of 5 images in 48 hours ${money(couples.addOns.rushPreview.price)}.`,
  );

  return {
    verified: true,
    lines,
    basePrices: showAllPackages
      ? sessionKeys.map((key) => couples.packages[key].price)
      : [pkg.price],
    addOnPrices: [
      couples.addOns.extraLocation.price, couples.addOns.extraOutfit.price,
      couples.addOns.extra30Minutes.price, couples.addOns.expedited.price,
      couples.addOns.rushPreview.price, couples.addOns.proofingGallery.price,
    ],
    needsManualQuote: null,
  };
}

/**
 * Elopement and courthouse ceremony coverage.
 *
 * Every figure here is read off the catalog, so the email, the rates page and
 * the contract cannot drift apart. The base is a FLOOR, not a package price:
 * two hours at $950, with anything longer quoted by hand. needsManualQuote
 * carries that distinction rather than suppressing the price, because the
 * starting figure is what a client asking about an elopement needs to hear.
 *
 * The only quotable add-on is the second location, and it buys a stop rather
 * than time. Extra coverage is a custom quote, named without a number, which
 * leaves the validator free to flag any figure the model attaches to it.
 */
function elopementFacts(): PricingFacts {
  const elopement = PRICING_CATALOG.elopement;
  const hours = elopement.durationMinutes / 60;
  const lines = [
    `Elopement and courthouse ceremony coverage STARTS AT ${money(elopement.startingPrice)} for ${hours} hours. Say "starts at ${money(elopement.startingPrice)}" or "${money(elopement.startingPrice)} for ${hours} hours of coverage". Longer coverage costs more, so never call ${money(elopement.startingPrice)} the total without settling the hours.`,
    `It covers the ceremony, couple portraits afterward, immediate family and small-group portraits, posing guidance, a minimum of ${elopement.minimumImages} edited high-resolution images, and a private online gallery.`,
    `${hours} hours is the base. Never offer unlimited coverage, and never state a different number of hours as if it were included. Ask whether ${hours} hours covers what they have planned.`,
    `An additional nearby location is ${money(elopement.addOns.extraLocation.price)}, for example a courthouse ceremony followed by beach or park portraits. It is a second stop INSIDE the ${hours} hours, not extra time, and a spot that needs substantial extra travel can cost more than that.`,
    "Coverage beyond the base is a custom quote. Say you'll put a figure together once the timing is settled, and do not price it yourself.",
    "Travel outside San Francisco is calculated separately from round-trip distance. There is no flat travel fee, so state an amount only if one is given to you as a verified fact.",
  ];

  return {
    verified: true,
    lines,
    basePrices: [elopement.startingPrice],
    addOnPrices: [elopement.addOns.extraLocation.price],
    needsManualQuote:
      `${money(elopement.startingPrice)} covers ${hours} hours and is verified. Anything longer is not: price extra coverage by hand rather than in this email. Quote the starting price, add the ${money(elopement.addOns.extraLocation.price)} second location only if they raised one, and check the hours before promising a total.`,
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
    // Read off the catalog: a fixed price, or both ends of a range.
    addOnPrices: addOnPriceValues(families.addOns),
    needsManualQuote,
  };
}

/**
 * The maternity session: one package, partner and immediate family included.
 *
 * Travel is described without its per-mile rate on purpose: the validator
 * treats every figure here as quotable, and a mileage rate is not a price.
 */
function maternityFacts(): PricingFacts {
  const maternity = PRICING_CATALOG.maternity;
  const { extraOutfit, secondLocation, expedited } = maternity.addOns;
  return {
    verified: true,
    lines: [
      `${maternity.label}: ${money(maternity.price)}, ${maternity.durationMinutes}-minute session, ${maternity.minimumImages}+ edited images, ${maternity.locations} location and ${maternity.outfits} outfit. Partner and immediate family, kids included, are part of this package, so it is never a family session.`,
      `Add-ons: extra outfit ${money(extraOutfit.price)}, second nearby location ${money(secondLocation.price)}, 72-hour gallery ${money(expedited.price)}.`,
      "Travel outside San Francisco is calculated separately from round-trip distance. There is no flat travel fee, so state an amount only if one is given to you as a verified fact.",
    ],
    basePrices: [maternity.price],
    addOnPrices: [extraOutfit.price, secondLocation.price, expedited.price],
    needsManualQuote: null,
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
    `Travel outside San Francisco: ${events.addOns.travel.displayPrice}. Never work out a venue's travel fee yourself; state one only if it is given to you as a fact.`,
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
    case "couples":    return couplesFacts(detectCouplesPackage(sessionType, message), true);
    case "family":     return familyFacts(people);
    case "maternity":  return maternityFacts();
    case "event":      return eventFacts();
    case "headshot":   return unpricedSessionFacts("headshot");
    case "portrait":   return unpricedSessionFacts("individual portrait");
    case "elopement":  return elopementFacts();
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

/**
 * Travel, as a verified fee, an explicit unknown, or nothing when the shoot is
 * in the city.
 *
 * Reads the LOCATION as well as the school, and prefers it. Travel follows
 * where the camera goes, not where the client studies: Chris re-quoted a Santa
 * Clara graduate who moved the shoot to Filoli. The decision itself lives in
 * lib/travelResolution.ts, shared with the contract and payment totals.
 */
export function buildTravelFact(
  school: string | null | undefined,
  location?: string | null,
  message?: string | null,
  options: { schoolImpliesLocation?: boolean } = {},
): string | null {
  return renderTravelFact(resolveTravel({ school, location, message, ...options }));
}

/** The travel fact for an already-resolved destination. */
export function renderTravelFact(travel: TravelResolution): string | null {
  // Worded as a constraint on CLAIMS, with relevance left to the stage, so an
  // out-of-city draft only mentions travel when it is quoting a price.
  const unknown = (subject: string) =>
    `${subject} is outside San Francisco, so a travel fee applies, but its amount is NOT in the rate card. Never state a travel-fee amount or work one out yourself, and never give a session total that is missing it. Mention travel ONLY if you are quoting a price in this email or they asked what it costs; then one clause is enough ("plus a travel fee for ${subject}, which I'll confirm for you"). The destination is known, so do not ask them to confirm the location again; a meeting spot still to be picked does not change it. If this email is not about price, leave travel out entirely.`;

  // The wording carries no other dollar figure, because the validator treats
  // every figure in this fact as quotable.
  const verified = (subject: string, fee: number) =>
    `Travel fee for ${subject}: ${money(fee)}. This is the verified fee; use it as given and never recalculate it, even if an older email in the thread shows a different travel amount. When you quote the session price, add it and give the all-in total as one figure, the way Chris does ("plus a travel fee of X, so Y total").`;

  switch (travel.kind) {
    case "verified": return verified(travel.place, travel.fee);
    case "included": return `No travel fee for ${travel.place}, it's in San Francisco.`;
    case "unknown": return unknown(travel.place);
    default: return null;
  }
}

/**
 * Contact details, so the draft can never dangle a reference to one.
 *
 * A real draft wrote "If you need to reach me, here's my number" and then
 * stopped, because the number was nowhere in the prompt. Chris does give it
 * out, in logistics emails: "You can also text me at 408-722-7680 if you need
 * anything before the session".
 *
 * The Gmail signature the send path appends carries his email and website but
 * NOT the phone number, so putting it in the body duplicates nothing.
 */
export const CONTACT = {
  phone: "408-722-7680",
  email: "soloxsnaps@gmail.com",
  website: "soloxsnaps.com",
} as const;

export function buildContactFacts(): string[] {
  return [
    `Chris's phone number is ${CONTACT.phone}, worth giving only for a booked session that is coming up, and only with the digits written out. His Gmail signature is appended automatically after your text and already carries his name, email and website, so write no sign-off, no name, and no other contact detail.`,
  ];
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
