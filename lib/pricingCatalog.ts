export const BOOKING_POLICY = {
  retainerPercent: 50,
  retainerRefundability: "non-refundable",
  remainingBalanceDeadline: "on or before the session date",
  contractDeadline: "before the session",
  // Public wording for reply time. "Most" on purpose: never an absolute promise.
  inquiryResponse: "Most inquiries receive a response within 24 hours.",
  inquiryResponseShort: "Replies within 24 hours",
  // The delivered gallery is the only deliverable. Proofing (couples add-on)
  // picks favorites from a lightly culled gallery; it is not a RAW delivery.
  rawPolicy:
    "RAW and unedited images are not provided. Every delivered photograph is professionally selected and edited to reflect the final SoloXSnaps photography style.",
} as const;

// Explicit extension: tests/pricingCatalog.test.mjs loads this file with
// Node's native TypeScript support, which does not guess extensions.
import { TRAVEL_RATE_LABEL, verifiedTravelFee } from "./travelFee.ts";

const STANDARD_TURNAROUND_DAYS = 14;

const RATE_PER_MILE_LABEL = `${TRAVEL_RATE_LABEL} / mile (round trip)`;

export const PRICING_CATALOG = {
  standardTurnaroundDays: STANDARD_TURNAROUND_DAYS,
  graduation: {
    baseHourlyRate: 350,
    standardMinimumImages: 50,
    groupMinimumImagesPerPerson: 25,
    groupRates: {
      2: 300,
      3: 275,
      4: 250,
      5: 225,
      6: 200,
    },
    addOns: {
      extraOutfit: {
        label: "Additional outfit",
        shortLabel: "Extra outfit",
        price: 75,
      },
      secondLocation: {
        label: "Second nearby off-campus location",
        shortLabel: "Second location",
        price: 125,
      },
      expedited: {
        label: "72-hour full gallery delivery",
        shortLabel: "72-hour delivery",
        price: 150,
      },
      champagne: {
        label: "Champagne setup (provided by photographer)",
        shortLabel: "Champagne",
        price: 15,
      },
      extra30Minutes: {
        label: "Extended time",
        shortLabel: "Extra 30 minutes",
        price: 100,
      },
    },
    travelFees: {
      "sf-state": null,
      "usf": null,
      "sf-other": null,
      "uc-berkeley": verifiedTravelFee("uc-berkeley"),
      "csueb": verifiedTravelFee("csueb"),
      "sjsu": verifiedTravelFee("sjsu"),
      "santa-clara": verifiedTravelFee("santa-clara"),
      "stanford": verifiedTravelFee("stanford"),
      "other": undefined,
    },
    durationRules: {
      allowedMinutes: [60, 90, 120],
      standardMinutes: 60,
      groupMinimumSize: 3,
      groupMinimumMinutes: 90,
    },
  },
  couples: {
    packages: {
      mini: {
        label: "30-Min Mini Session",
        price: 350,
        durationMinutes: 30,
        durationLabel: "30 minute session",
        minimumImages: 25,
      },
      "1hr": {
        label: "1-Hour Session",
        price: 450,
        durationMinutes: 60,
        durationLabel: "1 hour session",
        minimumImages: 40,
      },
      signature: {
        label: "Signature Session",
        price: 575,
        durationMinutes: 90,
        durationLabel: "75-90 minute session",
        minimumImages: 60,
      },
      engagement: {
        label: "Engagement Session",
        price: 650,
        durationMinutes: 90,
        durationLabel: "90 minute session",
        minimumImages: 70,
      },
      proposal: {
        label: "Proposal Session",
        price: 750,
        durationLabel: "Proposal coverage and portraits",
        minimumImages: 50,
      },
    },
    addOns: {
      extraLocation: { label: "Additional nearby location", shortLabel: "Extra location", price: 125 },
      extraOutfit: { label: "Additional outfit", shortLabel: "Extra outfit", price: 75 },
      extra30Minutes: { label: "Extra 30 minutes", shortLabel: "Extra 30 minutes", price: 175 },
      proofingGallery: { label: "Client proofing gallery", shortLabel: "Proofing gallery", price: 75 },
      rushPreview: { label: "Rush preview - 5 edited images within 48 hours", shortLabel: "Rush preview", price: 75 },
      expedited: { label: "Expedited full gallery delivery within 72 hours", shortLabel: "72-hour delivery", price: 150 },
      advancedRetouching: { label: "Advanced retouching", displayPrice: "$25 / image" },
    },
    travelFees: {
      sf: null,
      oakland: undefined,
      berkeley: verifiedTravelFee("uc-berkeley"),
      peninsula: undefined,
      "south-bay": undefined,
      "santa-clara": verifiedTravelFee("santa-clara"),
      other: undefined,
    },
  },
  // Ceremony coverage, priced from a floor rather than a package.
  //
  // The price STARTS AT $950 for the two hours: longer coverage is quoted by
  // hand, so nothing here may be read as a final total. An additional location
  // does NOT extend the two hours — it is a second stop inside the same window.
  elopement: {
    startingPrice: 950,
    durationMinutes: 120,
    durationLabel: "2 hours of coverage",
    minimumImages: 60,
    addOns: {
      extraLocation: { label: "Additional nearby location", shortLabel: "Extra location", price: 125 },
      extraCoverage: { label: "Additional photography coverage", displayPrice: "Custom quote" },
      travel: { label: "Travel outside the standard service area", displayPrice: `${RATE_PER_MILE_LABEL} + tolls` },
    },
  },
  // One package. Partner and immediate family are included, so a maternity
  // shoot that includes kids is still this package, not a family session.
  maternity: {
    label: "Maternity Session",
    price: 500,
    durationMinutes: 60,
    minimumImages: 30,
    locations: 1,
    outfits: 1,
    addOns: {
      extraOutfit: { label: "Additional outfit", shortLabel: "Extra outfit", price: 75 },
      secondLocation: { label: "Second nearby location", shortLabel: "Second location", price: 125 },
      expedited: { label: "72-hour full gallery delivery", shortLabel: "72-hour delivery", price: 150 },
      travel: { label: "Travel outside San Francisco", displayPrice: `${RATE_PER_MILE_LABEL} + tolls` },
    },
  },
  families: {
    packages: {
      standard: { label: "Family Session", price: 350, durationMinutes: 30, minimumImages: 10 },
      extended: { label: "Extended Family Session", price: 500, durationMinutes: 60, minimumImages: 30 },
    },
    addOns: {
      extraLocation: { label: "Additional nearby location", displayPrice: "$125" },
      expedited: { label: "72-hour full gallery delivery", displayPrice: "$150" },
      extendedFamily: { label: "Extended family members", displayPrice: "$50-$75" },
      extra30Minutes: { label: "Additional time", displayPrice: "$100 / 30 min" },
    },
  },
  events: {
    smallEvent: {
      hourlyRate: 500,
      minimumHours: 2,
      minimumImages: 30,
      turnaroundLabel: "1-2 week standard turnaround",
    },
    mediumEvent: {
      hourlyRate: 450,
      minimumHours: 4,
      exampleHours: [4, 5, 6],
    },
    largeEvent: {
      halfDayHours: 5,
      halfDayPrice: 2200,
      fullDayStartingPrice: 4000,
    },
    addOns: {
      secondShooter: { label: "Second shooter", displayPrice: "$100-$150 / hr" },
      expedited: { label: "48-72 hour expedited delivery", displayPrice: "$250-$500" },
      travel: { label: "Travel outside San Francisco", displayPrice: `${RATE_PER_MILE_LABEL} + tolls` },
    },
  },
} as const;

export function getBookingPolicyItems(): string[] {
  return [
    `${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer to reserve the session.`,
    `Contract completed ${BOOKING_POLICY.contractDeadline}.`,
    `Remaining balance due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
  ];
}

/**
 * Retainer split in integer cents. An odd cent goes to the retainer, so the
 * two parts always sum exactly to the total.
 */
export function calculatePaymentScheduleCents(totalCents: number): {
  retainer: number;
  remainingBalance: number;
} {
  const cents = Math.max(0, Math.round(totalCents));
  const retainer = Math.round((cents * BOOKING_POLICY.retainerPercent) / 100);
  return { retainer, remainingBalance: cents - retainer };
}

/** Same split for a total in dollars; the math runs in cents, so $351 → $175.50 / $175.50. */
export function calculatePaymentSchedule(total: number): {
  retainer: number;
  remainingBalance: number;
} {
  const { retainer, remainingBalance } = calculatePaymentScheduleCents(Math.round(total * 100));
  return { retainer: retainer / 100, remainingBalance: remainingBalance / 100 };
}

export function inferTotalFromRetainer(retainer: number): number {
  return Math.round(retainer / (BOOKING_POLICY.retainerPercent / 100));
}

export function getGraduationTravelFeeFromText(text: string): number {
  const normalized = text.toLowerCase();
  if (/\bstanford\b/.test(normalized)) return PRICING_CATALOG.graduation.travelFees.stanford;
  if (/\buc berkeley\b|\bberkeley\b|\bcal bears\b/.test(normalized)) return PRICING_CATALOG.graduation.travelFees["uc-berkeley"];
  if (/\bcsueb\b|cal state east bay|eastbay/.test(normalized)) return PRICING_CATALOG.graduation.travelFees.csueb;
  if (/\bsjsu\b|san jose state/.test(normalized)) return PRICING_CATALOG.graduation.travelFees.sjsu;
  if (/\bsanta clara\b|\bscu\b/.test(normalized)) return PRICING_CATALOG.graduation.travelFees["santa-clara"];
  return 0;
}

export function getMinimumImageCountForSessionType(sessionType: string): number {
  const normalized = sessionType.toLowerCase();
  if (/\bgraduat|\bgrad\b/.test(normalized)) return PRICING_CATALOG.graduation.standardMinimumImages;
  if (/\bmaternity\b/.test(normalized)) return PRICING_CATALOG.maternity.minimumImages;
  // Before the couples patterns: an elopement message routinely mentions a
  // "couple" and must not fall through to the couples minimum.
  if (/\belop|courthouse|wedding ceremony/.test(normalized)) return PRICING_CATALOG.elopement.minimumImages;
  if (/\bproposal\b/.test(normalized)) return PRICING_CATALOG.couples.packages.proposal.minimumImages;
  if (/\bengagement\b/.test(normalized)) return PRICING_CATALOG.couples.packages.engagement.minimumImages;
  if (/\bsignature\b/.test(normalized)) return PRICING_CATALOG.couples.packages.signature.minimumImages;
  if (/\bmini\b/.test(normalized)) return PRICING_CATALOG.couples.packages.mini.minimumImages;
  if (/\bcouple|\banniversary\b/.test(normalized)) return PRICING_CATALOG.couples.packages["1hr"].minimumImages;
  if (/\bextended family\b/.test(normalized)) return PRICING_CATALOG.families.packages.extended.minimumImages;
  if (/\bfamily\b/.test(normalized)) return PRICING_CATALOG.families.packages.standard.minimumImages;
  return PRICING_CATALOG.events.smallEvent.minimumImages;
}

/** "$70" for whole dollars, "$43.50" when a toll adds cents. */
export function formatFee(amount: number): string {
  return Number.isInteger(amount)
    ? `$${amount.toLocaleString("en-US")}`
    : `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CAMPUS_SHORT_NAMES: Partial<Record<keyof typeof PRICING_CATALOG.graduation.travelFees, string>> = {
  "uc-berkeley": "Berkeley",
  sjsu: "SJSU",
  csueb: "CSU East Bay",
  "santa-clara": "Santa Clara",
  stanford: "Stanford",
};

export function getGraduationTravelNote(school: keyof typeof PRICING_CATALOG.graduation.travelFees): string {
  const fee = PRICING_CATALOG.graduation.travelFees[school];
  if (fee === null) return "No travel fee for San Francisco locations.";
  if (typeof fee === "number") return `${CAMPUS_SHORT_NAMES[school]} sessions include a ${formatFee(fee)} travel fee from San Francisco.`;
  return "Travel fee will be confirmed after the exact location is reviewed.";
}
