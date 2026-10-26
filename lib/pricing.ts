// lib/pricing.ts - SoloXSnaps pricing calculations.
// Operational rates and policies live in pricingCatalog.ts.

import {
  PRICING_CATALOG,
  calculatePaymentSchedule,
  formatFee,
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
// Per school, from lib/travelFee.ts ($0.70/round-trip mile + tolls).
// null = included (inside SF). undefined = no verified route, confirmed per spot.
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

// ── GROUP DURATION RULES ─────────────────────────────────────────────────────
const DURATION_RULES = PRICING_CATALOG.graduation.durationRules
const SESSION_LENGTH_KEYS = Object.keys(SESSION_LENGTHS) as SessionLengthKey[]

function minutesOf(length: SessionLengthKey): number {
  return SESSION_LENGTHS[length] * 60
}

/** Minutes the session price already covers: 60 for 1–2 people, 90 for groups of 3+. */
export function includedMinutesFor(people: number): number {
  return people >= DURATION_RULES.groupMinimumSize
    ? DURATION_RULES.groupMinimumMinutes
    : DURATION_RULES.standardMinutes
}

/** Groups of 3+ can't book under the group minimum (90 minutes). */
export function isSessionLengthAllowed(people: number, length: SessionLengthKey): boolean {
  return minutesOf(length) >= includedMinutesFor(people)
}

/** The requested length, raised to the shortest allowed length when it is too short. */
export function enforceSessionLength(people: number, requested: SessionLengthKey): SessionLengthKey {
  if (isSessionLengthAllowed(people, requested)) return requested
  return SESSION_LENGTH_KEYS.find((key) => isSessionLengthAllowed(people, key)) ?? requested
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
  travelMethod: "mileage" | "none" | "tbd"
  groupNote: string | null
}

export type GraduationEstimate = EstimateResult & { sessionLength: SessionLengthKey }

function graduationSessionBase(people: number, sessionLength: SessionLengthKey): number {
  if (people <= 1) return GRAD_HOURLY_RATE * SESSION_LENGTHS[sessionLength]
  // Group rate is per person and already covers the included time (60 min, or
  // the 90-minute group minimum for 3+) — the same rule the contract tool and
  // the email assistant quote. Time past that is the extra-30-minutes add-on.
  const extraHalfHours = Math.max(0, minutesOf(sessionLength) - includedMinutesFor(people)) / 30
  return getGroupRatePerPerson(people) * people + extraHalfHours * ADDON_EXTRA_30_MIN
}

export function calculateGraduationEstimate(input: EstimateInput): GraduationEstimate {
  const { school, people, extraOutfit, secondLocation, expedited, champagne } = input
  const sessionLength = enforceSessionLength(people, input.sessionLength)
  const sessionBase = graduationSessionBase(people, sessionLength)

  let addons = 0
  if (extraOutfit)    addons += ADDON_EXTRA_OUTFIT
  if (secondLocation) addons += ADDON_SECOND_LOCATION
  if (expedited)      addons += ADDON_EXPEDITED
  if (champagne)      addons += ADDON_CHAMPAGNE

  const travelFee = getTravelFeeForSchool(school)
  const travelMethod: EstimateResult["travelMethod"] =
    travelFee === null      ? "none" :
    travelFee === undefined ? "tbd"  :
    "mileage"

  const subtotal = sessionBase + addons + (travelFee ?? 0)
  const { retainer: deposit, remainingBalance } = calculatePaymentSchedule(subtotal)

  const groupNote = people >= DURATION_RULES.groupMinimumSize
    ? `Groups of ${DURATION_RULES.groupMinimumSize} or more book at least ${DURATION_RULES.groupMinimumMinutes} minutes for individual and group photos. That time is included in the group rate.`
    : null

  return { sessionBase, travelFee, addons, subtotal, deposit, remainingBalance, travelMethod, groupNote, sessionLength }
}

export function formatCurrency(amount: number): string {
  return formatFee(amount)
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
    "mileage"
  const travelAmount = (travelFee ?? 0) as number

  const subtotal = pkg.price + addons + travelAmount
  const paymentSchedule = calculatePaymentSchedule(subtotal);
  const deposit = paymentSchedule.retainer;
  const remainingBalance = paymentSchedule.remainingBalance;

  return { sessionBase: pkg.price, travelFee, addons, subtotal, deposit, remainingBalance, travelMethod, groupNote: null }
}
