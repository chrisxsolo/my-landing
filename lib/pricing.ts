// lib/pricing.ts — SoloXSnaps pricing logic
// Update rates here to keep pricing consistent across the site.

// ── BASE RATES ────────────────────────────────────────────────────────────────
export const GRAD_HOURLY_RATE = 350 // 1 graduate, per hour

export const GROUP_RATES: Record<number, number> = {
  2: 300,
  3: 275,
  4: 250,
  5: 225,
}
export const GROUP_RATE_6_PLUS = 200

// ── ADD-ON RATES ──────────────────────────────────────────────────────────────
export const ADDON_EXTRA_OUTFIT     = 75
export const ADDON_SECOND_LOCATION  = 125
export const ADDON_EXPEDITED        = 75
export const ADDON_CHAMPAGNE        = 15
export const ADDON_EXTRA_30_MIN     = 100

// ── SESSION LENGTH (in hours) ─────────────────────────────────────────────────
export const SESSION_LENGTHS = {
  "1hr":    1,
  "1.5hr":  1.5,
  "2hr":    2,
} as const
export type SessionLengthKey = keyof typeof SESSION_LENGTHS

// ── TRAVEL FEES ───────────────────────────────────────────────────────────────
// Flat fees per school. null = no travel fee. undefined = fee TBD.
export const TRAVEL_FEES: Record<string, number | null | undefined> = {
  "sf-state":    null,
  "usf":         null,
  "sf-other":    null,
  "uc-berkeley": 35,
  "csueb":       30,
  "sjsu":        75,
  "santa-clara": 70,
  "stanford":    undefined, // TODO: confirm
  "other":       undefined, // calculated or TBD
}

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
  const deposit  = Math.ceil(subtotal * 0.5)
  const remainingBalance = subtotal - deposit

  // Group note
  const groupNote =
    people >= 3 && sessionLength === "1hr"
      ? "Groups of 3 or more usually need at least 90 minutes for individual and group photos."
      : null

  return { sessionBase, travelFee, addons, subtotal, deposit, remainingBalance, travelMethod, groupNote }
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`
}
