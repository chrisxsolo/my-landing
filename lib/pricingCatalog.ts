export const BOOKING_POLICY = {
  retainerPercent: 50,
  retainerRefundability: "non-refundable",
  remainingBalanceDeadline: "on or before the session date",
  contractDeadline: "before the session",
} as const;

const STANDARD_TURNAROUND_DAYS = 14;

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
      "uc-berkeley": 35,
      "csueb": 30,
      "sjsu": 75,
      "santa-clara": 70,
      "stanford": 45,
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
      shortFormVideo: { label: "Short-form video / BTS reel", displayPrice: "$175+" },
      advancedRetouching: { label: "Advanced retouching", displayPrice: "$25 / image" },
    },
    travelFees: {
      sf: null,
      oakland: 35,
      berkeley: 35,
      peninsula: 45,
      "south-bay": 75,
      "santa-clara": 70,
      other: undefined,
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
      travel: { label: "Travel beyond 20 miles of SF", displayPrice: "$0.75-$1.00 / mile (round trip)" },
    },
    includedTravelMiles: 20,
  },
} as const;

export function getBookingPolicyItems(): string[] {
  return [
    `${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer to reserve the session.`,
    `Contract completed ${BOOKING_POLICY.contractDeadline}.`,
    `Remaining balance due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
  ];
}

export function calculatePaymentSchedule(total: number): {
  retainer: number;
  remainingBalance: number;
} {
  const retainer = Math.round(total * (BOOKING_POLICY.retainerPercent / 100));
  return { retainer, remainingBalance: total - retainer };
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
  if (/\bproposal\b/.test(normalized)) return PRICING_CATALOG.couples.packages.proposal.minimumImages;
  if (/\bengagement\b/.test(normalized)) return PRICING_CATALOG.couples.packages.engagement.minimumImages;
  if (/\bsignature\b/.test(normalized)) return PRICING_CATALOG.couples.packages.signature.minimumImages;
  if (/\bmini\b/.test(normalized)) return PRICING_CATALOG.couples.packages.mini.minimumImages;
  if (/\bcouple|\banniversary\b/.test(normalized)) return PRICING_CATALOG.couples.packages["1hr"].minimumImages;
  if (/\bextended family\b/.test(normalized)) return PRICING_CATALOG.families.packages.extended.minimumImages;
  if (/\bfamily\b/.test(normalized)) return PRICING_CATALOG.families.packages.standard.minimumImages;
  return PRICING_CATALOG.events.smallEvent.minimumImages;
}

export function getGraduationTravelNote(school: keyof typeof PRICING_CATALOG.graduation.travelFees): string {
  const fee = PRICING_CATALOG.graduation.travelFees[school];
  if (fee === null) return "No travel fee for San Francisco locations.";
  if (typeof fee === "number") return `${school === "uc-berkeley" ? "Berkeley" : school === "sjsu" ? "SJSU" : school === "csueb" ? "CSU East Bay" : school === "santa-clara" ? "Santa Clara" : "Stanford"} sessions include a $${fee} travel fee from San Francisco.`;
  return "Travel fee will be confirmed after the exact location is reviewed.";
}
