// ─────────────────────────────────────────────────────────────────────────────
// The authoritative quote for a draft, and where a draft departs from it.
//
// Draft AI writes prices in prose. This module never trusts that prose: it
// computes what the quote SHOULD be from the rate card (pricingCatalog via
// businessFacts, travel via lib/travelResolution) and compares.
//
//   authoritativeQuote   session + travel = total, from application data only
//   staleQuotedPrices    thread prices explained by a superseded travel figure
//                        (the $70 SJSU formula fee, or a travel amount an
//                        older email stated), which must not outrank today's
//                        approved fee unless the admin confirms that quote
//   checkDraftQuote      the draft's stated travel fee and total vs the above
//   correctDraftPricing  rewrites only the mismatched figures, nothing else
// ─────────────────────────────────────────────────────────────────────────────

import { GRAD_HOURLY_RATE, getGroupRatePerPerson } from "@/lib/pricing";
import { calculatedTravelFee, APPROVED_TRAVEL_FEES, type VerifiedRouteKey } from "@/lib/travelFee";
import type { TravelResolution } from "@/lib/travelResolution";
import type { ThreadMessage } from "./threadDigest";

export interface QuoteLine {
  kind: "session" | "travel";
  label: string;
  amount: number;
}

export interface QuoteBreakdown {
  lines: QuoteLine[];
  total: number;
}

export interface QuoteMismatch {
  kind: "travel" | "total";
  stated: number;
  expected: number;
  /** The exact text that carries the wrong figure, for highlighting and correction. */
  excerpt: string;
}

export interface DraftQuoteCheck {
  /** Null when the draft quotes nothing, or the rate card cannot price this session. */
  breakdown: QuoteBreakdown | null;
  mismatches: QuoteMismatch[];
  /** True when the draft states at least one price. */
  quotesPrice: boolean;
}

/** What the quote is computed from: the context's own verified facts. */
export interface QuoteInput {
  playbook: string | null;
  people: string | null;
  basePrices: number[];
  addOnPrices: number[];
  travel: TravelResolution;
  /** Prices the admin confirmed as agreed for this client; never flagged. */
  confirmedPrices?: number[];
}

const MONEY = String.raw`\$\s?([\d,]+(?:\.\d{2})?)`;
const toNumber = (raw: string) => Number(raw.replace(/,/g, ""));

/** "$75 travel fee", "travel fee of $75", "travel fee for SJSU is $75", "$75 for travel". */
const TRAVEL_FIGURE = new RegExp(
  String.raw`${MONEY}\s*(?:travel\b|for travel\b)|travel(?: fee)?\b(?:(?!total|\bso\b|brings)[^$\n.!?]){0,40}?${MONEY}`, "gi",
);

/** "so $425 total", "$425 in total", "total of $425", "brings the session total to $425". */
const TOTAL_FIGURE = new RegExp(
  String.raw`${MONEY}\s*(?:total|in total|all in|all-in)\b|\btotal\b[^$\n.!?]{0,30}?${MONEY}`, "gi",
);

function figures(text: string, pattern: RegExp): { amount: number; excerpt: string }[] {
  return [...text.matchAll(pattern)].map((m) => ({
    amount: toNumber(m[1] ?? m[2]),
    excerpt: m[0],
  })).filter((f) => Number.isFinite(f.amount) && f.amount > 0);
}

function money(amount: number): string {
  return Number.isInteger(amount) ? `$${amount.toLocaleString("en-US")}` : `$${amount.toFixed(2)}`;
}

function peopleCount(raw: string | null): number {
  const n = Number((raw ?? "").match(/\d+/)?.[0] ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 1;
}

function travelLabel(travel: TravelResolution): string {
  if (travel.kind !== "verified") return "Travel fee";
  return travel.campus === "sjsu" ? "SJSU travel fee" : `Travel fee (${travel.place})`;
}

/** The session line the rate card can name without guessing, or null. */
function sessionLine(input: QuoteInput, draftPrices: number[]): QuoteLine | null {
  if (input.playbook === "graduation") {
    const people = peopleCount(input.people);
    if (people <= 1) return { kind: "session", label: "Graduation session", amount: GRAD_HOURLY_RATE };
    const rate = getGroupRatePerPerson(people);
    return { kind: "session", label: `Graduation session (${people} × ${money(rate)})`, amount: rate * people };
  }
  // Other services offer several packages: use the one the draft names, if exactly one.
  const named = input.basePrices.filter((p) => draftPrices.includes(p));
  if (named.length === 1) return { kind: "session", label: "Session", amount: named[0] };
  return input.basePrices.length === 1 ? { kind: "session", label: "Session", amount: input.basePrices[0] } : null;
}

/** Session plus the verified travel fee. Add-ons are left to the draft's own wording. */
export function authoritativeQuote(input: QuoteInput, draftPrices: number[] = []): QuoteBreakdown | null {
  const session = sessionLine(input, draftPrices);
  if (!session) return null;
  const lines: QuoteLine[] = [session];
  if (input.travel.kind === "verified") {
    lines.push({ kind: "travel", label: travelLabel(input.travel), amount: input.travel.fee });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) };
}

/** Every total a base plus any subset of the extras can reach. */
function reachable(bases: number[], extras: number[]): Set<number> {
  let sums = new Set<number>(bases);
  for (const extra of extras) {
    const next = new Set(sums);
    for (const total of sums) next.add(total + extra);
    sums = next;
  }
  return sums;
}

/** Travel amounts that are no longer the fee for this destination. */
function supersededTravelFigures(travel: TravelResolution, messages: readonly ThreadMessage[]): number[] {
  if (travel.kind !== "verified") return [];
  const superseded = new Set<number>();
  const key = travel.campus as VerifiedRouteKey;
  if (APPROVED_TRAVEL_FEES[key]) superseded.add(calculatedTravelFee(key));
  for (const m of messages) {
    if (!m.fromMe) continue;
    for (const f of figures(m.body, TRAVEL_FIGURE)) superseded.add(f.amount);
  }
  superseded.delete(travel.fee);
  return [...superseded];
}

/**
 * Thread prices that only an outdated travel figure explains. A deliberate
 * custom price (a $275 short-notice discount) is not stale: nothing superseded
 * produces it, so it stays the client's quote.
 */
export function staleQuotedPrices(
  quoted: readonly number[], input: QuoteInput, messages: readonly ThreadMessage[],
): number[] {
  const old = supersededTravelFigures(input.travel, messages);
  if (old.length === 0) return [];
  const currentTravel = input.travel.kind === "verified" ? [input.travel.fee] : [];
  const current = reachable(input.basePrices, [...input.addOnPrices, ...currentTravel]);
  for (const fee of currentTravel) current.add(fee);
  const confirmed = new Set(input.confirmedPrices ?? []);
  const explainedByOld = new Set<number>(old);
  for (const fee of old) for (const total of reachable(input.basePrices, input.addOnPrices)) explainedByOld.add(total + fee);
  return quoted.filter((p) => explainedByOld.has(p) && !current.has(p) && !confirmed.has(p));
}

function statedPrices(draft: string): number[] {
  return [...draft.matchAll(new RegExp(MONEY, "g"))].map((m) => toNumber(m[1]));
}

export function checkDraftQuote(draft: string, input: QuoteInput): DraftQuoteCheck {
  const prices = statedPrices(draft);
  if (prices.length === 0) return { breakdown: null, mismatches: [], quotesPrice: false };
  const confirmed = new Set(input.confirmedPrices ?? []);
  const breakdown = authoritativeQuote(input, prices);
  const mismatches: QuoteMismatch[] = [];

  const expectedTravel = input.travel.kind === "verified" ? input.travel.fee : null;
  for (const f of figures(draft, TRAVEL_FIGURE)) {
    if (confirmed.has(f.amount) || f.amount === expectedTravel) continue;
    // Included or unknown travel has no amount the draft may state.
    mismatches.push({ kind: "travel", stated: f.amount, expected: expectedTravel ?? 0, excerpt: f.excerpt });
  }

  if (breakdown) {
    const extras = expectedTravel === null ? input.addOnPrices : [...input.addOnPrices, expectedTravel];
    const valid = reachable(breakdown.lines.filter((l) => l.kind === "session").map((l) => l.amount), extras);
    const travelWrong = mismatches.find((m) => m.kind === "travel");
    for (const f of figures(draft, TOTAL_FIGURE)) {
      if (confirmed.has(f.amount) || valid.has(f.amount)) continue;
      // Re-base the stated total on the right travel fee when that explains it.
      const expected = travelWrong && valid.has(f.amount - travelWrong.stated + travelWrong.expected)
        ? f.amount - travelWrong.stated + travelWrong.expected
        : breakdown.total;
      mismatches.push({ kind: "total", stated: f.amount, expected, excerpt: f.excerpt });
    }
  }
  return { breakdown, mismatches, quotesPrice: true };
}

/**
 * The draft with each mismatched figure replaced by the authoritative one,
 * inside the phrase that carried it. Wording around it is untouched. A travel
 * figure for included/unknown travel has no right amount, so it is left for
 * the admin to reword.
 */
export function correctDraftPricing(draft: string, check: DraftQuoteCheck): string {
  return check.mismatches.reduce((text, m) => {
    if (m.expected <= 0) return text;
    const fixed = m.excerpt.replace(/\$\s?[\d,]+(?:\.\d{2})?/, money(m.expected));
    return text.replace(m.excerpt, fixed);
  }, draft);
}

/** Thread prices as numbers ("$1,200" → 1200). */
export function parseQuotedPrices(quoted: readonly string[]): number[] {
  return quoted.map((q) => toNumber(q.replace(/^\$\s?/, ""))).filter((n) => Number.isFinite(n) && n > 0);
}
