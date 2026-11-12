// lib/pricing.ts - SoloXSnaps pricing calculations.
// Operational rates and policies live in pricingCatalog.ts.

import {
  PRICING_CATALOG,
  calculatePaymentSchedule,
  formatFee,
} from "./pricingCatalog";

// ── GRADUATION PACKAGES ───────────────────────────────────────────────────────
// Two individual packages at their own prices. There is no hourly rate: the
// mini is not half the hour, and time past the hour is the extra-30-minutes
// add-on. Groups pay a PER-GRADUATE rate that covers their included time.
const GRADUATION = PRICING_CATALOG.graduation;
export const GRAD_PACKAGES = GRADUATION.packages;
export const GRAD_MINI_PRICE = GRAD_PACKAGES.mini.price;
export const GRAD_SESSION_PRICE = GRAD_PACKAGES.standard.price;
export type GraduationPackageKey = keyof typeof GRAD_PACKAGES;

export const GROUP_RATES_PER_PERSON: Readonly<Record<number, number>> = GRADUATION.groupRatesPerPerson;
export const MINI_MAX_PEOPLE: number = GRADUATION.headcountRules.miniMaxPeople;
export const GROUP_MIN_PEOPLE: number = GRADUATION.headcountRules.groupMinPeople;
/** The largest group the rate card prices; above it the quote is done by hand. */
export const GROUP_MAX_PEOPLE: number = GRADUATION.headcountRules.groupMaxPeople;

// ── ADD-ON RATES ──────────────────────────────────────────────────────────────
export const ADDON_EXTRA_OUTFIT = GRADUATION.addOns.extraOutfit.price;
export const ADDON_SECOND_LOCATION = GRADUATION.addOns.secondLocation.price;
export const ADDON_EXPEDITED = GRADUATION.addOns.expedited.price;
export const ADDON_CHAMPAGNE = GRADUATION.addOns.champagne.price;
export const ADDON_EXTRA_30_MIN = GRADUATION.addOns.extra30Minutes.price;

// ── SESSION LENGTHS (in minutes) ──────────────────────────────────────────────
// Keys travel in estimator state and booking-intent links; minutes are what
// the rate card prices. Every entry is one of the catalog's allowed lengths.
export const SESSION_LENGTH_MINUTES = {
  "30min": GRAD_PACKAGES.mini.durationMinutes,
  "1hr": GRAD_PACKAGES.standard.durationMinutes,
  "1.5hr": 90,
  "2hr": 120,
} as const;
export type SessionLengthKey = keyof typeof SESSION_LENGTH_MINUTES;

// ── TRAVEL FEES ───────────────────────────────────────────────────────────────
// Per school, from lib/travelFee.ts ($0.70/round-trip mile + tolls).
// null = included (inside SF). undefined = no verified route, confirmed per spot.
export const TRAVEL_FEES: Record<string, number | null | undefined> = {
  ...GRADUATION.travelFees,
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

/** Whether the rate card prices this headcount at all (one graduate, or a group up to the maximum). */
export function isHeadcountPriced(people: number): boolean {
  return Number.isInteger(people) && people >= 1 && people <= GROUP_MAX_PEOPLE
}

/** Nine or more graduates: no automatic price, Chris quotes it by hand. */
export function requiresManualGroupQuote(people: number): boolean {
  return people > GROUP_MAX_PEOPLE
}

/** The per-graduate group rate, or null for one graduate and for groups the rate card does not price. */
export function getGroupRatePerPerson(people: number): number | null {
  if (people < GROUP_MIN_PEOPLE || !isHeadcountPriced(people)) return null
  return GROUP_RATES_PER_PERSON[people] ?? null
}

// ── DURATION RULES ───────────────────────────────────────────────────────────
const DURATION_RULES = GRADUATION.durationRules
const SESSION_LENGTH_KEYS = Object.keys(SESSION_LENGTH_MINUTES) as SessionLengthKey[]

function minutesOf(length: SessionLengthKey): number {
  return SESSION_LENGTH_MINUTES[length]
}

/**
 * Minutes the standard price already covers: the 60-minute package for one
 * graduate, 60 for two, the 90-minute minimum for groups of 3+.
 */
export function includedMinutesFor(people: number): number {
  return people >= DURATION_RULES.groupMinimumSize
    ? DURATION_RULES.groupMinimumMinutes
    : DURATION_RULES.standardMinutes
}

/** The shortest bookable length: the 30-minute mini for one graduate, else the included time. */
export function shortestMinutesFor(people: number): number {
  return people <= MINI_MAX_PEOPLE ? GRAD_PACKAGES.mini.durationMinutes : includedMinutesFor(people)
}

/** The mini is for one graduate only; groups of 3+ can't book under their 90-minute minimum. */
export function isSessionLengthAllowed(people: number, length: SessionLengthKey): boolean {
  return minutesOf(length) >= shortestMinutesFor(people)
}

/** The requested length, raised to the shortest allowed length when it is too short. */
export function enforceSessionLength(people: number, requested: SessionLengthKey): SessionLengthKey {
  if (isSessionLengthAllowed(people, requested)) return requested
  return SESSION_LENGTH_KEYS.find((key) => isSessionLengthAllowed(people, key)) ?? requested
}

/** Which individual package a one-graduate booking of this length is. */
export function graduationPackageFor(durationMinutes: number): GraduationPackageKey {
  return durationMinutes <= GRAD_PACKAGES.mini.durationMinutes ? "mini" : "standard"
}

function extraTimeCharge(durationMinutes: number, includedMinutes: number): number {
  const extraHalfHours = Math.max(0, Math.ceil((durationMinutes - includedMinutes) / 30))
  return extraHalfHours * ADDON_EXTRA_30_MIN
}

/**
 * The graduation session price for a headcount and length, or null when the
 * rate card has no figure (nine or more graduates). The estimator, Draft AI's
 * facts, the quote check, the contract, payment totals and the invoice draft
 * all read it from here, so the package and group rules live in one place.
 *
 * One graduate: the 30-minute mini, or the 60-minute package plus the
 * extra-30-minutes add-on for each half hour past it ($525 / $625). A group
 * pays the per-graduate rate, which covers the included time (60 minutes for
 * two, the 90-minute minimum for 3+), plus the same add-on past that.
 */
export function graduationSessionPrice(people: number, durationMinutes: number = includedMinutesFor(people)): number | null {
  if (!isHeadcountPriced(people)) return null
  if (people <= MINI_MAX_PEOPLE) {
    const pkg = GRAD_PACKAGES[graduationPackageFor(durationMinutes)]
    return pkg.price + extraTimeCharge(durationMinutes, pkg.durationMinutes)
  }
  const ratePerPerson = getGroupRatePerPerson(people)
  if (ratePerPerson === null) return null
  return ratePerPerson * people + extraTimeCharge(durationMinutes, includedMinutesFor(people))
}

/** "Graduation Mini (30 min)", "Graduation Session (60 min)", "Group rate (3 × $325), 120 min". */
export function graduationSessionLabel(people: number, durationMinutes: number = includedMinutesFor(people)): string {
  if (people <= MINI_MAX_PEOPLE) {
    const pkg = GRAD_PACKAGES[graduationPackageFor(durationMinutes)]
    const extra = durationMinutes > pkg.durationMinutes ? `, ${durationMinutes} min` : ""
    return `${pkg.label} (${pkg.durationMinutes} min)${extra}`
  }
  const rate = getGroupRatePerPerson(people)
  const headcount = rate === null ? `${people} graduates` : `${people} × ${formatFee(rate)}`
  const extra = durationMinutes > includedMinutesFor(people) ? `, ${durationMinutes} min` : ""
  return `Group rate (${headcount})${extra}`
}

// ── DURATION PARSER ──────────────────────────────────────────────────────────
// Mirrored in pixieset-extension/extensionPricing.js (detectGradDurationMinutes);
// tests/unit/graduationDurationParser.test.ts runs both on the same cases.
const HOURS_WORD: Record<string, number> = { a: 1, an: 1, one: 1, full: 1, two: 2, three: 3 }
const MINUTES_WORD: Record<string, number> = { thirty: 30, forty: 40, sixty: 60, ninety: 90 }
const HOUR = String.raw`(?:hours?|hrs?)`
const MINUTE = String.raw`(?:minutes?|mins?)`
const HOUR_COUNT = String.raw`(\d+(?:\.\d+)?|one|two|three|full|an?)`
const MINUTE_COUNT = String.raw`(\d+|thirty|forty|sixty|ninety)`

const hoursOf = (raw: string) => HOURS_WORD[raw] ?? Number(raw)
const minutesOfWord = (raw: string) => MINUTES_WORD[raw] ?? Number(raw)

/**
 * Every way a client writes a length, compound forms first so "1 hour 30
 * minutes" is one 90-minute phrase and never the 30 of its second half. Each
 * pattern is anchored at a word start and tried at every position in order.
 */
const DURATION_PATTERNS: { re: RegExp; minutes: (m: RegExpExecArray) => number }[] = [
  { re: new RegExp(String.raw`\b${HOUR_COUNT}\s*-?\s*${HOUR}\s*(?:and|plus|&|\+)?\s*${MINUTE_COUNT}\s*-?\s*${MINUTE}\b`, "y"),
    minutes: (m) => hoursOf(m[1]) * 60 + minutesOfWord(m[2]) },
  { re: new RegExp(String.raw`\b(?:(?:an?|one|1)\s+)?${HOUR}\s+and\s+a\s+half\b`, "y"), minutes: () => 90 },
  { re: new RegExp(String.raw`\b(?:one|1)\s*(?:and\s+a\s+half|1/2|½)\s*${HOUR}\b`, "y"), minutes: () => 90 },
  { re: new RegExp(String.raw`\bhalf\s*(?:an?\s*)?(?:hour|hr)\b`, "y"), minutes: () => 30 },
  { re: new RegExp(String.raw`\b${HOUR_COUNT}\s*-?\s*${HOUR}\b`, "y"), minutes: (m) => Math.round(hoursOf(m[1]) * 60) },
  { re: new RegExp(String.raw`\b${MINUTE_COUNT}\s*-?\s*${MINUTE}\b`, "y"), minutes: (m) => minutesOfWord(m[1]) },
  { re: /\bmini\b/y, minutes: () => GRAD_PACKAGES.mini.durationMinutes },
]

// Words that tie a length to the booking, and words that make it some other
// span (delivery, turnaround, arrival, travel). The nearer kind decides.
const SESSION_WORDS = /\b(?:sessions?|length|coverage|package|shoot|photoshoot|book(?:ing)?|mini|photos?|portraits?|slot)\b/g
const UNRELATED_WORDS = /\b(?:deliver(?:y|ed|ing|s)?|turnaround|gallery|edits?|editing|reply|respond|within|early|late|before|after|ahead|prior|arrive|arrival|drive|driving|away|commute|notice|days?|weeks?)\b/g

type DurationMention = { minutes: number; start: number; end: number }

function durationMentions(clause: string): DurationMention[] {
  const found: DurationMention[] = []
  let at = 0
  while (at < clause.length) {
    const hit = DURATION_PATTERNS.map((p) => { p.re.lastIndex = at; return { p, m: p.re.exec(clause) } }).find((x) => x.m)
    if (hit?.m) {
      found.push({ minutes: hit.p.minutes(hit.m), start: at, end: at + hit.m[0].length })
      at += Math.max(1, hit.m[0].length)
    } else {
      at += 1
    }
  }
  return found
}

/** Distance from a mention to the nearest word of a kind in the same clause, or Infinity. */
function nearestDistance(clause: string, mention: DurationMention, words: RegExp): number {
  let best = Infinity
  for (const m of clause.matchAll(words)) {
    const wordStart = m.index ?? 0
    const wordEnd = wordStart + m[0].length
    if (wordEnd <= mention.start) best = Math.min(best, mention.start - wordEnd)
    else if (wordStart >= mention.end) best = Math.min(best, wordStart - mention.end)
    else best = 0
  }
  return best
}

type MentionKind = "tied" | "neutral" | "unrelated"

function classifyMention(clause: string, mention: DurationMention): MentionKind {
  const tied = nearestDistance(clause, mention, SESSION_WORDS)
  const unrelated = nearestDistance(clause, mention, UNRELATED_WORDS)
  if (tied === Infinity && unrelated === Infinity) return "neutral"
  return tied <= unrelated ? "tied" : "unrelated"
}

/**
 * Every distinct length a client named in free text ("30 min", "mini",
 * "1.5 hours", "1 hour 30 minutes", "two hours"). Lengths tied to session
 * wording outrank neutral ones unless `everyMention` is set; unrelated spans
 * ("delivered within 2 hours") never count. More than one is a conflict.
 */
export function graduationDurationsNamed(text: string | null | undefined, everyMention = false): number[] {
  const found: { minutes: number; kind: MentionKind }[] = []
  // Sentence breaks scope the context words; a period inside "1.5" is not one.
  for (const clause of (text ?? "").toLowerCase().split(/[!?;\n]+|\.(?!\d)/)) {
    for (const mention of durationMentions(clause)) {
      found.push({ minutes: mention.minutes, kind: classifyMention(clause, mention) })
    }
  }
  const tied = found.filter((f) => f.kind === "tied")
  const counted = tied.length && !everyMention ? tied : found.filter((f) => f.kind !== "unrelated")
  return [...new Set(counted.map((f) => f.minutes))]
}

/** The one length the text names, or null when it names none or two that disagree. */
export function detectGraduationDurationMinutes(text: string | null | undefined): number | null {
  const named = graduationDurationsNamed(text)
  return named.length === 1 ? named[0] : null
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

export type GraduationEstimate = EstimateResult & { sessionLength: SessionLengthKey; sessionLabel: string }

/**
 * The public estimate. Throws for a headcount the rate card does not price;
 * the estimator shows a custom-quote path for those instead of calling this.
 */
export function calculateGraduationEstimate(input: EstimateInput): GraduationEstimate {
  const { school, people, extraOutfit, secondLocation, expedited, champagne } = input
  const sessionLength = enforceSessionLength(people, input.sessionLength)
  const minutes = minutesOf(sessionLength)
  const sessionBase = graduationSessionPrice(people, minutes)
  if (sessionBase === null) {
    throw new RangeError(`Groups of more than ${GROUP_MAX_PEOPLE} graduates are quoted by hand, not by the estimator.`)
  }

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

  // Whole dollars in, so the sum is exact; the retainer split runs in cents.
  const subtotal = sessionBase + addons + (travelFee ?? 0)
  const { retainer: deposit, remainingBalance } = calculatePaymentSchedule(subtotal)

  const groupNote = people >= DURATION_RULES.groupMinimumSize
    ? `Groups of ${DURATION_RULES.groupMinimumSize} or more book at least ${DURATION_RULES.groupMinimumMinutes} minutes for individual and group photos. That time is included in the per-person group rate.`
    : null

  return {
    sessionBase, travelFee, addons, subtotal, deposit, remainingBalance, travelMethod, groupNote,
    sessionLength, sessionLabel: graduationSessionLabel(people, minutes),
  }
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
