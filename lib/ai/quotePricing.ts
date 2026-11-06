// ─────────────────────────────────────────────────────────────────────────────
// The authoritative quote for a draft, and where a draft departs from it.
//
// Draft AI writes prices in prose. This module never trusts that prose: it
// computes what the quote SHOULD be from the rate card (pricingCatalog via
// businessFacts, travel via lib/travelResolution) and compares.
//
//   authoritativeQuote   session + travel = total, from application data only
//   staleQuotedPrices    thread prices explained by a superseded travel figure
//                        (the $70 SJSU formula fee, the $43.50 UC Berkeley
//                        sum before the final nearest-$5 rounding, or a
//                        travel amount an older email stated), which must not
//                        outrank today's fee unless the admin confirms that quote
//   checkDraftQuote      the draft's stated travel fee and total vs the above
//   correctDraftPricing  rewrites only the mismatched figures, nothing else
// ─────────────────────────────────────────────────────────────────────────────

import { GRAD_PACKAGES, graduationSessionLabel, graduationSessionPrice, includedMinutesFor } from "@/lib/pricing";
import { supersededTravelFees, type VerifiedRouteKey } from "@/lib/travelFee";
import type { TravelResolution } from "@/lib/travelResolution";
import type { ThreadMessage } from "./threadDigest";
import { EIGHT_PERSON_SPORTS_SENIOR_OFFER, SPORTS_TEAM_PORTRAIT_PLAYBOOK, sportsTeamOfferOptions } from "./sportsTeamPortraitPricing";
import { sportsTeamPerPersonForClause } from "./sportsTeamPortraitChecks";

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
  /**
   * `per_person` is a package's per-head breakdown stated wrongly: the total
   * can be right while the figure beside it is not, so it is checked as its
   * own semantic role rather than as a price in its own right.
   */
  kind: "travel" | "total" | "per_person";
  stated: number;
  /** For `per_person`, 0 when neither option's figure can be assigned with certainty. */
  expected: number;
  /** The exact text that carries the wrong figure, for highlighting and correction. */
  excerpt: string;
  /**
   * True when `expected` is the rate card's own figure and nothing else
   * explains the stated one: a verified travel fee, or a total that is right
   * once that fee is put back. False for a travel amount at a location with
   * no verified fee, and for a total the rate card can only guess at (it may
   * carry an add-on the draft priced wrongly). Only a certain mismatch may be
   * corrected without the admin.
   */
  certain: boolean;
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
  /**
   * Per-person breakdowns of a package total (lib/ai/businessFacts). Valid as
   * stated, and never part of the arithmetic that reaches a package total.
   */
  informationalPrices?: number[];
  travel: TravelResolution;
  /** Prices the admin confirmed as agreed for this client; never flagged. */
  confirmedPrices?: number[];
  /** The graduation length the client asked for, in minutes; the included length when absent. */
  durationMinutes?: number;
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

const PER_HEAD_NOUN = String.raw`(?:per|a|for each)\s+(?:person|player|athlete|senior|participant|head|student|graduate|grad)`;

/** "$100 per person", "$150 a head", "$250 each". A bare "$800 a session" is not one. */
export const PER_PERSON_FIGURE = new RegExp(String.raw`${MONEY}\s*(?:${PER_HEAD_NOUN}|each|apiece)\b`, "gi");

/** The same with the person named: "$75 each" alone may describe an add-on, "$75 per person" claims a rate. */
export const PER_HEAD_FIGURE = new RegExp(String.raw`${MONEY}\s*${PER_HEAD_NOUN}\b`, "gi");

function figures(text: string, pattern: RegExp): { amount: number; excerpt: string; moneyIndex: number }[] {
  return [...text.matchAll(pattern)].map((m) => ({
    amount: toNumber(m[1] ?? m[2]),
    excerpt: m[0],
    // Where the dollar sign itself sits, so two patterns that caught the same
    // figure in different roles can be told apart.
    moneyIndex: (m.index ?? 0) + m[0].indexOf("$"),
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

/**
 * Every session line the rate card could stand behind for this inquiry.
 *
 * Graduation: one line once the headcount and length are known. For one
 * graduate who has not said how long a session they want, BOTH packages are
 * candidates (the mini and the hour), so neither is treated as a mismatch.
 * Nine or more graduates have no rate-card line at all.
 */
function sessionCandidates(input: QuoteInput, draftPrices: number[]): QuoteLine[] {
  // Two alternative packages for one fixed headcount, both always valid, read
  // from the offer's own source so this file never carries its figures.
  if (input.playbook === SPORTS_TEAM_PORTRAIT_PLAYBOOK) {
    return sportsTeamOfferOptions().map((option) => ({
      kind: "session" as const,
      label: `Sports-team portraits, ${option.durationMinutes} min (${EIGHT_PERSON_SPORTS_SENIOR_OFFER.headcount} people)`,
      amount: option.total,
    }));
  }
  if (input.playbook === "graduation") {
    const people = peopleCount(input.people);
    const lengths = input.durationMinutes !== undefined
      ? [input.durationMinutes]
      : people <= 1 ? [GRAD_PACKAGES.mini.durationMinutes, GRAD_PACKAGES.standard.durationMinutes] : [includedMinutesFor(people)];
    // One duration rule for every surface (lib/pricing.ts).
    return lengths.flatMap((minutes) => {
      const amount = graduationSessionPrice(people, minutes);
      return amount === null ? [] : [{ kind: "session" as const, label: graduationSessionLabel(people, minutes), amount }];
    });
  }
  // Other services offer several packages: use the one the draft names, if exactly one.
  const named = input.basePrices.filter((p) => draftPrices.includes(p));
  if (named.length === 1) return [{ kind: "session", label: "Session", amount: named[0] }];
  return input.basePrices.length === 1 ? [{ kind: "session", label: "Session", amount: input.basePrices[0] }] : [];
}

/**
 * The session line the rate card can name without guessing, or null. With
 * two candidate packages, the one the draft prices wins; otherwise the
 * standard (longer) package is shown, with the mini still accepted as valid.
 */
function sessionLine(input: QuoteInput, draftPrices: number[]): QuoteLine | null {
  const candidates = sessionCandidates(input, draftPrices);
  if (candidates.length === 0) return null;
  const named = candidates.filter((c) => draftPrices.includes(c.amount));
  if (named.length === 1) return named[0];
  return candidates.at(-1) ?? null;
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
  // The policy's own outdated figures for this campus (lib/travelFee.ts).
  const superseded = new Set<number>(supersededTravelFees(travel.campus as VerifiedRouteKey));
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

/** The sentence a figure sits in, so a duration named beside it can be read. */
function sentenceAround(draft: string, excerpt: string): string {
  return draft.split(/(?<=[.!?])\s+|\n+/).find((sentence) => sentence.includes(excerpt)) ?? excerpt;
}

/**
 * Per-person figures against the sports-team offer.
 *
 * $100 belongs to 30 minutes and $150 to 60 minutes. A figure beside a
 * duration (or beside that option's total) is checked against that option
 * and corrected with certainty; one with no duration nearby is accepted if it
 * is either option's figure and flagged, uncorrected, otherwise. No other
 * playbook has a per-person semantics the rate card can stand behind here.
 */
function perPersonMismatches(draft: string, input: QuoteInput, confirmed: Set<number>): QuoteMismatch[] {
  if (input.playbook !== SPORTS_TEAM_PORTRAIT_PLAYBOOK) return [];
  const informational = new Set(input.informationalPrices ?? []);
  const mismatches: QuoteMismatch[] = [];
  for (const f of figures(draft, PER_PERSON_FIGURE)) {
    if (confirmed.has(f.amount)) continue;
    const linked = sportsTeamPerPersonForClause(sentenceAround(draft, f.excerpt));
    if (linked !== null) {
      if (f.amount !== linked) mismatches.push({ kind: "per_person", stated: f.amount, expected: linked, excerpt: f.excerpt, certain: true });
    } else if (!informational.has(f.amount)) {
      mismatches.push({ kind: "per_person", stated: f.amount, expected: 0, excerpt: f.excerpt, certain: false });
    }
  }
  return mismatches;
}

export function checkDraftQuote(draft: string, input: QuoteInput): DraftQuoteCheck {
  const prices = statedPrices(draft);
  if (prices.length === 0) return { breakdown: null, mismatches: [], quotesPrice: false };
  const confirmed = new Set(input.confirmedPrices ?? []);
  const breakdown = authoritativeQuote(input, prices);
  const mismatches: QuoteMismatch[] = [];

  const expectedTravel = input.travel.kind === "verified" ? input.travel.fee : null;
  // "$150 per person before travel" is a per-person figure, whatever the word
  // "travel" nearby suggests; it is never read as a travel fee.
  const perPersonAt = new Set(figures(draft, PER_PERSON_FIGURE).map((f) => f.moneyIndex));
  for (const f of figures(draft, TRAVEL_FIGURE)) {
    if (perPersonAt.has(f.moneyIndex)) continue;
    if (confirmed.has(f.amount) || f.amount === expectedTravel) continue;
    // Included or unknown travel has no amount the draft may state.
    mismatches.push({
      kind: "travel", stated: f.amount, expected: expectedTravel ?? 0, excerpt: f.excerpt, certain: expectedTravel !== null,
    });
  }

  if (breakdown) {
    const extras = expectedTravel === null ? input.addOnPrices : [...input.addOnPrices, expectedTravel];
    // Any candidate package is a valid base, not only the one shown.
    const valid = reachable(sessionCandidates(input, prices).map((l) => l.amount), extras);
    const travelWrong = mismatches.find((m) => m.kind === "travel");
    for (const f of figures(draft, TOTAL_FIGURE)) {
      if (confirmed.has(f.amount) || valid.has(f.amount)) continue;
      // Re-base the stated total on the right travel fee when that explains it.
      const rebased = travelWrong ? f.amount - travelWrong.stated + travelWrong.expected : NaN;
      const certain = valid.has(rebased);
      mismatches.push({ kind: "total", stated: f.amount, expected: certain ? rebased : breakdown.total, excerpt: f.excerpt, certain });
    }
  }
  mismatches.push(...perPersonMismatches(draft, input, confirmed));
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

export interface PricingEnforcement {
  /** The draft as it was before the rate card's figures replaced the model's; null when nothing changed. */
  originalDraft: string | null;
  /** The figures that were replaced, in draft order. */
  corrections: QuoteMismatch[];
}

/**
 * The draft with every CERTAIN mismatch corrected, for the server to apply
 * before the draft reaches the admin. An ambiguous figure (a travel amount
 * for an unrouted location, a total the rate card can only guess at) is left
 * in place and stays flagged by validation; nothing here guesses.
 */
export function enforceDraftPricing(draft: string, input: QuoteInput): PricingEnforcement & { draft: string } {
  const check = checkDraftQuote(draft, input);
  const corrections = check.mismatches.filter((m) => m.certain);
  if (corrections.length === 0) return { draft, originalDraft: null, corrections: [] };
  return {
    draft: correctDraftPricing(draft, { ...check, mismatches: corrections }),
    originalDraft: draft,
    corrections,
  };
}

/** Thread prices as numbers ("$1,200" → 1200). */
export function parseQuotedPrices(quoted: readonly string[]): number[] {
  return quoted.map((q) => toNumber(q.replace(/^\$\s?/, ""))).filter((n) => Number.isFinite(n) && n > 0);
}
