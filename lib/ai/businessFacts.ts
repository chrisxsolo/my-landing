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
import { resolvePlaybookKey } from "./soloxsnapsWritingProfile";

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
  } else {
    const perPerson = peopleCount >= 6
      ? grad.groupRates[6]
      : grad.groupRates[peopleCount as 2 | 3 | 4 | 5] ?? grad.groupRates[6];
    const total = perPerson * peopleCount;
    lines.push(`Group graduation rate for ${peopleCount} graduates: ${money(perPerson)} per person, ${money(total)} total, ${grad.groupMinimumImagesPerPerson}+ edited images per person.`);
    if (peopleCount >= grad.durationRules.groupMinimumSize) {
      lines.push(`Groups of ${grad.durationRules.groupMinimumSize} or more need at least ${grad.durationRules.groupMinimumMinutes} minutes.`);
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
  const needsManualQuote = peopleCount > 8
    ? `${peopleCount} people is above the standard family session — confirm the price by hand before quoting.`
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

function parsePeople(value: string | number | null | undefined, message: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const field = String(value ?? "").match(/\d+/);
  if (field) return Math.max(1, Number(field[0]));
  const inMessage = message.match(/\b(\d+)\s*(?:people|persons|of us|graduates|grads|kids|adults)\b/i);
  return inMessage ? Math.max(1, Number(inMessage[1])) : 1;
}

/**
 * Picks the couples package the client's own words point at.
 *
 * Proposal is tested first and with the same widened patterns as the playbook
 * matcher: "engagement photos, I'd love to ask her" is a proposal, and pricing
 * it as an engagement session under-quoted it by $100.
 */
function detectCouplesPackage(
  sessionType: string,
  message: string,
): keyof typeof PRICING_CATALOG.couples.packages {
  const text = `${sessionType} ${message}`.toLowerCase();
  if (/proposal|propos(?:e|ing|al)|pop the question|\bask (?:her|him|them)\b|said yes/.test(text)) return "proposal";
  if (/engagement|engaged|fianc/.test(text)) return "engagement";
  if (/signature|90 ?min|90-minute/.test(text)) return "signature";
  if (/\bmini\b|30 ?min|30-minute/.test(text)) return "mini";
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

/** Travel fee for a graduation campus, as a fact or an explicit unknown. */
export function buildTravelFact(school: string | null | undefined): string | null {
  if (!school?.trim()) return null;
  const fees = PRICING_CATALOG.graduation.travelFees;
  const normalized = school.toLowerCase();

  const match: [RegExp, keyof typeof fees][] = [
    [/sf ?state|san francisco state|sfsu/, "sf-state"],
    [/usf|university of san francisco/, "usf"],
    [/uc ?berkeley|berkeley|cal\b/, "uc-berkeley"],
    [/csueb|cal state east bay|east bay|hayward/, "csueb"],
    [/sjsu|san jose state/, "sjsu"],
    [/santa clara|scu/, "santa-clara"],
    [/stanford/, "stanford"],
    [/san francisco|\bsf\b/, "sf-other"],
  ];

  for (const [pattern, key] of match) {
    if (!pattern.test(normalized)) continue;
    const fee = fees[key];
    if (fee === null) return `No travel fee for ${school} — it's in San Francisco.`;
    if (typeof fee === "number") return `Travel fee for ${school}: ${money(fee)}.`;
    return `Travel fee for ${school} is not in the rate card and must be confirmed by hand.`;
  }
  return `Travel fee for ${school} is not in the rate card and must be confirmed by hand.`;
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
