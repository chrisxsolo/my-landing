// lib/pricing.ts - SoloXSnaps pricing calculations.
// Operational rates and policies live in pricingCatalog.ts.

import {
  PRICING_CATALOG,
  calculatePaymentSchedule,
} from "./pricingCatalog";

// ── BASE RATES ────────────────────────────────────────────────────────────────
export const GRAD_HOURLY_RATE = PRICING_CATALOG.graduation.baseHourlyRate;

export const GROUP_RATES: Record<number, number> = {
  2: PRICING_CATALOG.graduation.groupRates[2],
  3: PRICING_CATALOG.graduation.groupRates[3],
  4: PRICING_CATALOG.graduation.groupRates[4],
  5: PRICING_CATALOG.graduation.groupRates[5],
};
export const GROUP_RATE_6_PLUS = PRICING_CATALOG.graduation.groupRates[6];

// ── ADD-ON RATES ──────────────────────────────────────────────────────────────
export const ADDON_EXTRA_OUTFIT = PRICING_CATALOG.graduation.addOns.extraOutfit.price;
export const ADDON_SECOND_LOCATION = PRICING_CATALOG.graduation.addOns.secondLocation.price;
export const ADDON_EXPEDITED = PRICING_CATALOG.graduation.addOns.expedited.price;
export const ADDON_CHAMPAGNE = PRICING_CATALOG.graduation.addOns.champagne.price;
export const ADDON_EXTRA_30_MIN = PRICING_CATALOG.graduation.addOns.extra30Minutes.price;

// ── SESSION LENGTH (in hours) ─────────────────────────────────────────────────
export const SESSION_LENGTHS = {
  "1hr": PRICING_CATALOG.graduation.durationRules.allowedMinutes[0] / 60,
  "1.5hr": PRICING_CATALOG.graduation.durationRules.allowedMinutes[1] / 60,
  "2hr": PRICING_CATALOG.graduation.durationRules.allowedMinutes[2] / 60,
} as const;
export type SessionLengthKey = keyof typeof SESSION_LENGTHS;

// ── TRAVEL FEES ───────────────────────────────────────────────────────────────
// Flat fees per school. null = no travel fee. undefined = fee TBD.
export const TRAVEL_FEES: Record<string, number | null | undefined> = {
  ...PRICING_CATALOG.graduation.travelFees,
};

// ── SCHOOL LABELS ─────────────────────────────────────────────────────────────
export const SCHOOLS = [
  { value: "uc-berkeley",  label: "UC Berkeley" },
  { value: "sjsu",         label: "San Jose State" },
  { value: "sf-state",     label: "SF State" },
  { value: "usf",          label: "USF" },
  { value: "csueb",        label: "CSU East Bay" },
  { value: "santa-clara",  label: "Santa Clara" },
  { value: "stanford",     label: "Stanford / Palo Alto" },
  { value: "sf-other",     label: "San Francisco Location" },
  { value: "other",        label: "Other Bay Area Location" },
] as const
export type SchoolValue = typeof SCHOOLS[number]["value"]

// ── HELPERS ───────────────────────────────────────────────────────────────────

export function getTravelFeeForSchool(school: SchoolValue): number | null | undefined {
  return TRAVEL_FEES[school]
}

export function getGroupRatePerPerson(people: number): number {
  if (people <= 1) return GRAD_HOURLY_RATE
  if (people <= 5) return GROUP_RATES[people] ?? GROUP_RATE_6_PLUS
  return GROUP_RATE_6_PLUS
}

export interface EstimateInput {
  school: SchoolValue
  people: number
  sessionLength: SessionLengthKey
  extraOutfit: boolean
  secondLocation: boolean
  expedited: boolean
  champagne: boolean
}

export interface EstimateResult {
  sessionBase: number
  travelFee: number | null | undefined
  addons: number
  subtotal: number
  deposit: number
  remainingBalance: number
  travelMethod: "flat" | "mileage" | "none" | "tbd"
  groupNote: string | null
}

export function calculateGraduationEstimate(input: EstimateInput): EstimateResult {
  const { school, people, sessionLength, extraOutfit, secondLocation, expedited, champagne } = input
  const hours = SESSION_LENGTHS[sessionLength]

  // Session base
  let sessionBase: number
  if (people <= 1) {
    sessionBase = GRAD_HOURLY_RATE * hours
  } else {
    const ratePerPerson = getGroupRatePerPerson(people)
    // Group sessions: rate is per person, session length scales the cost
    // For groups, the per-person rate already implies a full session —
    // extra hours are charged at the per-person rate x people x (hours - 1)
    // Base = per-person rate × headcount; extra time = $100 per additional 30 min
    sessionBase = ratePerPerson * people
    if (hours > 1) {
      const extraHalfHours = (hours - 1) * 2
      sessionBase += extraHalfHours * ADDON_EXTRA_30_MIN
    }
  }

  // Add-ons
  let addons = 0
  if (extraOutfit)    addons += ADDON_EXTRA_OUTFIT
  if (secondLocation) addons += ADDON_SECOND_LOCATION
  if (expedited)      addons += ADDON_EXPEDITED
  if (champagne)      addons += ADDON_CHAMPAGNE

  // Travel
  const travelFee = getTravelFeeForSchool(school)
  const travelMethod: EstimateResult["travelMethod"] =
    travelFee === null      ? "none" :
    travelFee === undefined ? "tbd"  :
    "flat"

  const travelAmount = travelFee ?? 0

  const subtotal = sessionBase + addons + travelAmount
  const paymentSchedule = calculatePaymentSchedule(subtotal);
  const deposit = paymentSchedule.retainer;
  const remainingBalance = paymentSchedule.remainingBalance;

  // Group note
  const groupNote =
    people >= PRICING_CATALOG.graduation.durationRules.groupMinimumSize && sessionLength === "1hr"
      ? "Groups of 3 or more usually need at least 90 minutes for individual and group photos."
      : null

  return { sessionBase, travelFee, addons, subtotal, deposit, remainingBalance, travelMethod, groupNote }
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`
}

// ── COUPLES PACKAGES ─────────────────────────────────────────────────────────
export const COUPLES_PACKAGES = {
  mini: PRICING_CATALOG.couples.packages.mini,
  "1hr": PRICING_CATALOG.couples.packages["1hr"],
  signature: PRICING_CATALOG.couples.packages.signature,
  engagement: PRICING_CATALOG.couples.packages.engagement,
  proposal: PRICING_CATALOG.couples.packages.proposal,
} as const;
export type CouplesPackageKey = keyof typeof COUPLES_PACKAGES

// ── COUPLES LOCATIONS ────────────────────────────────────────────────────────
export const COUPLES_LOCATIONS = [
  { value: "sf", label: "San Francisco", fee: PRICING_CATALOG.couples.travelFees.sf },
  { value: "oakland", label: "Oakland / East Bay", fee: PRICING_CATALOG.couples.travelFees.oakland },
  { value: "berkeley", label: "Berkeley / UC Area", fee: PRICING_CATALOG.couples.travelFees.berkeley },
  { value: "peninsula", label: "Peninsula / Palo Alto", fee: PRICING_CATALOG.couples.travelFees.peninsula },
  { value: "south-bay", label: "South Bay / San Jose", fee: PRICING_CATALOG.couples.travelFees["south-bay"] },
  { value: "santa-clara", label: "Santa Clara", fee: PRICING_CATALOG.couples.travelFees["santa-clara"] },
  { value: "other", label: "Other Bay Area Location", fee: PRICING_CATALOG.couples.travelFees.other },
] as const
export type CouplesLocationValue = typeof COUPLES_LOCATIONS[number]["value"]

// ── COUPLES ADD-ON RATES ──────────────────────────────────────────────────────
export const COUPLES_ADDON_EXTRA_LOCATION = PRICING_CATALOG.couples.addOns.extraLocation.price;
export const COUPLES_ADDON_EXTRA_OUTFIT = PRICING_CATALOG.couples.addOns.extraOutfit.price;
export const COUPLES_ADDON_EXTRA_30_MIN = PRICING_CATALOG.couples.addOns.extra30Minutes.price;
export const COUPLES_ADDON_PROOFING = PRICING_CATALOG.couples.addOns.proofingGallery.price;
export const COUPLES_ADDON_RUSH_PREVIEW = PRICING_CATALOG.couples.addOns.rushPreview.price;
export const COUPLES_ADDON_EXPEDITED = PRICING_CATALOG.couples.addOns.expedited.price;

// ── COUPLES ESTIMATE ─────────────────────────────────────────────────────────
export interface CouplesEstimateInput {
  packageKey: CouplesPackageKey
  location: CouplesLocationValue
  extraLocation: boolean
  extraOutfit: boolean
  extra30Min: boolean
  proofingGallery: boolean
  rushPreview: boolean
  expedited: boolean
}

export function calculateCouplesEstimate(input: CouplesEstimateInput): EstimateResult {
  const pkg = COUPLES_PACKAGES[input.packageKey]

  let addons = 0
  if (input.extraLocation)  addons += COUPLES_ADDON_EXTRA_LOCATION
  if (input.extraOutfit)    addons += COUPLES_ADDON_EXTRA_OUTFIT
  if (input.extra30Min)     addons += COUPLES_ADDON_EXTRA_30_MIN
  if (input.proofingGallery) addons += COUPLES_ADDON_PROOFING
  if (input.rushPreview)    addons += COUPLES_ADDON_RUSH_PREVIEW
  if (input.expedited)      addons += COUPLES_ADDON_EXPEDITED

  const locationData = COUPLES_LOCATIONS.find(l => l.value === input.location)
  const travelFee = locationData?.fee as number | null | undefined
  const travelMethod: EstimateResult["travelMethod"] =
    travelFee === null      ? "none" :
    travelFee === undefined ? "tbd"  :
    "flat"
  const travelAmount = (travelFee ?? 0) as number

  const subtotal = pkg.price + addons + travelAmount
  const paymentSchedule = calculatePaymentSchedule(subtotal);
  const deposit = paymentSchedule.retainer;
  const remainingBalance = paymentSchedule.remainingBalance;

  return { sessionBase: pkg.price, travelFee, addons, subtotal, deposit, remainingBalance, travelMethod, groupNote: null }
}
