// lib/travelFee.ts - the one travel fee policy, for every service.
//
// Travel fee = round-trip driving miles x $0.70, rounded UP to the next $5,
// plus the tolls actually paid on the route, with that combined amount then
// rounded to the NEAREST $5 so no client ever sees a fee like $43.50. Travel
// inside San Francisco city limits is included in the session price. A
// destination with a business-approved fee (APPROVED_TRAVEL_FEES) charges that
// fee instead, untouched by either rounding.
//
// The mileage rounding is the business vault's rule (02 Pricing/Travel
// Fees.md: "round up to nearest $5"). It applies to the mileage charge only;
// tolls are added to the cent afterwards, because a toll is a pass-through
// cost. The final nearest-$5 rounding (2026-10-28) is applied once, to the
// mileage-plus-toll total, and never to either component on its own.
//
// All arithmetic is in integer cents. Distances are stored to the hundredth
// of a mile and converted to integer hundredths before multiplying, so no
// float ever reaches a price.
//
// Distances come from scripts/travel-route.mjs (OpenStreetMap geocoding and
// OSRM routing, both free). The precise origin lives only in that script;
// nothing here, and nothing sent to the AI, names more than "San Francisco".

export const TRAVEL_POLICY = {
  ratePerMileCents: 70,
  mileageRoundUpCents: 500,
  /** The step the mileage-plus-toll total is rounded to, nearest. */
  finalRoundingCents: 500,
  includedArea: "San Francisco city limits",
  originLabel: "San Francisco",
} as const;

/** "$0.70", for copy that states the rate. */
export const TRAVEL_RATE_LABEL = `$${(TRAVEL_POLICY.ratePerMileCents / 100).toFixed(2)}`;

type Heading = "eastbound" | "westbound";

/**
 * Bay Area state-owned bridge toll, 2-axle FasTrak rate, verified 2026-10-15
 * on bayareafastrak.org/en/toll-locations/toll-bridges.shtml. BATA's schedule
 * raises it each January (to $9.00 on 2027-01-01), so re-verify then.
 * These bridges collect westbound only.
 */
const STATE_BRIDGE_TOLL_CENTS = 850;

export const TOLL_BRIDGES = {
  bayBridge: { name: "Bay Bridge", collected: "westbound", cents: STATE_BRIDGE_TOLL_CENTS },
  sanMateoBridge: { name: "San Mateo-Hayward Bridge", collected: "westbound", cents: STATE_BRIDGE_TOLL_CENTS },
} as const satisfies Record<string, { name: string; collected: Heading; cents: number }>;

export type TollBridge = keyof typeof TOLL_BRIDGES;

/** One bridge crossing on the route, in the direction it was driven. */
export interface BridgeCrossing {
  bridge: TollBridge;
  heading: Heading;
}

export interface VerifiedRoute {
  label: string;
  /** Public campus address the route was measured to. */
  address: string;
  outboundMiles: number;
  returnMiles: number;
  /** Every bridge crossing on the out-and-back route, both directions. */
  crossings: readonly BridgeCrossing[];
  verifiedOn: string;
}

/**
 * Round trips measured from the business origin, out and back separately
 * (OSRM picks a slightly different return, so the real total is used rather
 * than one leg doubled). Re-run scripts/travel-route.mjs to add or refresh.
 */
export const VERIFIED_ROUTES = {
  "uc-berkeley": {
    label: "UC Berkeley",
    address: "Sather Gate, Berkeley, CA 94720",
    outboundMiles: 23.21,
    returnMiles: 20.9,
    crossings: [
      { bridge: "bayBridge", heading: "eastbound" },
      { bridge: "bayBridge", heading: "westbound" },
    ],
    verifiedOn: "2026-10-15",
  },
  csueb: {
    label: "CSU East Bay",
    address: "25800 Carlos Bee Blvd, Hayward, CA 94542",
    outboundMiles: 35.92,
    returnMiles: 35.52,
    crossings: [
      { bridge: "sanMateoBridge", heading: "eastbound" },
      { bridge: "sanMateoBridge", heading: "westbound" },
    ],
    verifiedOn: "2026-10-15",
  },
  sjsu: {
    label: "San Jose State",
    address: "1 Washington Sq, San Jose, CA 95192",
    outboundMiles: 49.09,
    returnMiles: 48.89,
    crossings: [],
    verifiedOn: "2026-10-15",
  },
  "santa-clara": {
    label: "Santa Clara University",
    address: "500 El Camino Real, Santa Clara, CA 95053",
    outboundMiles: 46.66,
    returnMiles: 46.18,
    crossings: [],
    verifiedOn: "2026-10-15",
  },
  stanford: {
    label: "Stanford",
    address: "Main Quad, 450 Jane Stanford Way, Stanford, CA 94305",
    outboundMiles: 33.11,
    returnMiles: 32.64,
    crossings: [],
    verifiedOn: "2026-10-15",
  },
} as const satisfies Record<string, VerifiedRoute>;

export type VerifiedRouteKey = keyof typeof VERIFIED_ROUTES;

export interface TravelFeeBreakdown {
  roundTripMiles: number;
  mileageCents: number;
  tollCents: number;
  /** Mileage charge plus tolls, before the final nearest-$5 rounding. */
  subtotalCents: number;
  /** The fee charged: the subtotal rounded to the nearest $5. */
  totalCents: number;
}

function toHundredths(miles: number): number {
  return Math.round(miles * 100);
}

/** Round-trip miles x rate, rounded up to the policy's $5 step. */
export function mileageChargeCents(roundTripMiles: number): number {
  // hundredths-of-a-mile x cents-per-mile = hundredths of a cent.
  const hundredthsOfCent = toHundredths(roundTripMiles) * TRAVEL_POLICY.ratePerMileCents;
  const step = TRAVEL_POLICY.mileageRoundUpCents * 100;
  return Math.ceil(hundredthsOfCent / step) * TRAVEL_POLICY.mileageRoundUpCents;
}

/** Tolls actually paid: a crossing counts only in the direction it is collected. */
export function tollChargeCents(crossings: readonly BridgeCrossing[]): number {
  return crossings
    .filter(({ bridge, heading }) => TOLL_BRIDGES[bridge].collected === heading)
    .reduce((sum, { bridge }) => sum + TOLL_BRIDGES[bridge].cents, 0);
}

/**
 * The final client-facing rounding: the mileage-plus-toll total to the
 * nearest $5 ($43.50 -> $45, $31 -> $30, $32.50 -> $35). Integer cents in,
 * integer cents out. Applied once, after mileage and tolls are settled.
 */
export function roundTravelFeeToNearestFive(totalCents: number): number {
  const step = TRAVEL_POLICY.finalRoundingCents;
  return Math.round(totalCents / step) * step;
}

export function calculateTravelFee(route: Pick<VerifiedRoute, "outboundMiles" | "returnMiles" | "crossings">): TravelFeeBreakdown {
  const roundTripMiles = (toHundredths(route.outboundMiles) + toHundredths(route.returnMiles)) / 100;
  const mileageCents = mileageChargeCents(roundTripMiles);
  const tollCents = tollChargeCents(route.crossings);
  const subtotalCents = mileageCents + tollCents;
  return { roundTripMiles, mileageCents, tollCents, subtotalCents, totalCents: roundTravelFeeToNearestFive(subtotalCents) };
}

/**
 * Business-approved fees that replace the mileage formula for a destination.
 *
 * The formula stays the reference (calculatedTravelFee keeps reporting it),
 * but an approved fee is what every client-facing surface charges. Distances
 * and the per-mile rate are never bent to hit an approved number.
 */
export interface ApprovedTravelFee {
  cents: number;
  approvedOn: string;
  note: string;
}

export const APPROVED_TRAVEL_FEES: Partial<Record<VerifiedRouteKey, ApprovedTravelFee>> = {
  // The formula gives $70 (97.98 mi x $0.70 = $68.59, up to $70); Chris's
  // approved SJSU fee is $75.
  sjsu: { cents: 7500, approvedOn: "2026-10-27", note: "Approved SJSU business fee" },
};

/** The mileage-formula fee, in dollars, before any approved override. Reference only. */
export function calculatedTravelFee(key: VerifiedRouteKey): number {
  return calculateTravelFee(VERIFIED_ROUTES[key]).totalCents / 100;
}

/** The fee charged for a verified destination, in whole dollars (a multiple of $5). */
export function verifiedTravelFee(key: VerifiedRouteKey): number {
  const approved = APPROVED_TRAVEL_FEES[key];
  return approved ? approved.cents / 100 : calculatedTravelFee(key);
}

/**
 * Figures the policy no longer charges for a destination, in dollars: the
 * formula fee where an approved fee replaces it (SJSU's $70), and the
 * unrounded mileage-plus-toll sum where the final rounding moved it (UC
 * Berkeley's $43.50). Quote validation treats these as outdated, never as
 * the current fee.
 */
export function supersededTravelFees(key: VerifiedRouteKey): number[] {
  const current = verifiedTravelFee(key);
  const breakdown = calculateTravelFee(VERIFIED_ROUTES[key]);
  const candidates = [breakdown.totalCents / 100, breakdown.subtotalCents / 100];
  return [...new Set(candidates.filter((fee) => fee !== current))];
}

/** Where a destination's fee comes from, for admin views that show the working. */
export function travelFeeBasis(key: VerifiedRouteKey): {
  fee: number;
  calculatedFee: number;
  roundTripMiles: number;
  source: "approved" | "mileage";
} {
  const calculated = calculateTravelFee(VERIFIED_ROUTES[key]);
  return {
    fee: verifiedTravelFee(key),
    calculatedFee: calculated.totalCents / 100,
    roundTripMiles: calculated.roundTripMiles,
    source: APPROVED_TRAVEL_FEES[key] ? "approved" : "mileage",
  };
}

/** Client-facing description of the rule, with no origin detail. */
export const TRAVEL_POLICY_SUMMARY =
  `Travel within ${TRAVEL_POLICY.includedArea} is included. Elsewhere, travel is ${TRAVEL_RATE_LABEL} per round-trip mile from ${TRAVEL_POLICY.originLabel} plus any bridge toll on the route, rounded to the nearest $5.`;
