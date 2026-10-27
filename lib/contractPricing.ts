// The contract's price, from what the thread agreed plus the rate card.
//
// The generator used to take one "agreed price" off the email thread and add
// the campus travel fee to it. When that price was already the all-in total
// ($425 = $350 session + $75 SJSU travel) the contract said $500.
//
// So the thread is read as separate parts and combined here, by code:
//   agreed total    the all-in figure both sides settled on → used as-is,
//                   travel never added on top
//   session price   the session alone → plus quoted add-ons plus travel to
//                   the shoot location (rate card first, a quoted figure only
//                   where the rate card has none)
// Anything that cannot be settled without guessing returns "review", and the
// contract carries a placeholder instead of a number. That includes an agreed
// total only a superseded travel fee explains ($420 = $350 + the old $70 SJSU
// formula fee): the same staleQuotedPrices check Draft AI runs.

import { classifySession } from "./ai/sessionClassifier";
import { buildQuoteInputForInquiry } from "./ai/inquiryQuote";
import { staleQuotedPrices } from "./ai/quotePricing";
import type { ThreadMessage } from "./ai/threadDigest";
import { GRAD_HOURLY_RATE, getGroupRatePerPerson } from "./pricing";
import { PRICING_CATALOG } from "./pricingCatalog";
import { resolveTravel, schoolImpliesLocationFor, type TravelResolution } from "./travelResolution";

export interface ExtractedPricing {
  /** An amount the thread calls the total / all-in price. */
  agreedTotal: number | null;
  /** The session price on its own. */
  sessionPrice: number | null;
  addOns: { label: string; amount: number }[];
  /** A travel amount stated in the thread. */
  travelFee: number | null;
  /** Whether the thread says the agreed total includes travel (null = not said). */
  includesTravel: boolean | null;
}

export interface ContractBooking {
  sessionType: string | null;
  school: string | null;
  /** Where the shoot happens: the thread's meeting spot, else the inquiry's location. */
  location: string | null;
  message: string | null;
  people?: string | number | null;
  /** The email thread, so a total built on an older quoted travel fee is caught. */
  messages?: readonly ThreadMessage[];
}

export interface PriceLine { label: string; amount: number }

export type ContractPricing =
  | { status: "ok"; total: number; lines: PriceLine[]; note: string | null }
  | { status: "review"; total: number | null; lines: PriceLine[]; reason: string };

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

function travelFor(booking: ContractBooking): TravelResolution {
  const service = classifySession(booking.sessionType, booking.message).key;
  const graduation = schoolImpliesLocationFor(service);
  return resolveTravel({
    school: booking.school,
    location: booking.location,
    // The message may name an out-of-city place; a campus mention alone counts only for a graduation.
    message: graduation ? booking.message : null,
    schoolImpliesLocation: graduation,
  });
}

/** Rate-card session prices this booking could have been quoted at. */
function catalogSessionPrices(booking: ContractBooking): number[] {
  const service = classifySession(booking.sessionType, booking.message).key;
  if (service === "maternity") return [PRICING_CATALOG.maternity.price];
  if (service !== "graduation") return [];
  const people = Number(String(booking.people ?? "1").match(/\d+/)?.[0] ?? 1) || 1;
  return people > 1 ? [getGroupRatePerPerson(people) * people] : [GRAD_HOURLY_RATE];
}

/** Whether only an outdated travel figure explains this agreed total. */
function isStaleAgreedTotal(total: number, travel: TravelResolution, booking: ContractBooking): boolean {
  const messages = booking.messages ?? [];
  const { input } = buildQuoteInputForInquiry(booking, { travel, messages });
  return staleQuotedPrices([total], input, messages).length > 0;
}

function fromAgreedTotal(total: number, extracted: ExtractedPricing, travel: TravelResolution, booking: ContractBooking): ContractPricing {
  const lines = [{ label: "Agreed total", amount: total }];
  if (travel.kind === "verified" && isStaleAgreedTotal(total, travel, booking)) {
    return {
      status: "review", total: null, lines,
      reason: `The thread agrees ${money(total)}, which only an outdated travel fee explains. The approved travel fee for ${travel.place} is ${money(travel.fee)}. Confirm the current total, or that the earlier quote was agreed, before sending.`,
    };
  }
  const travelDue = travel.kind === "verified" || travel.kind === "unknown";
  // An agreed total equal to a bare session price, with travel due and the
  // thread silent on whether it is included, could be either. Don't guess.
  if (travelDue && extracted.includesTravel !== true && catalogSessionPrices(booking).includes(total)) {
    return {
      status: "review", total: null, lines,
      reason: `The thread agrees ${money(total)}, which matches the session price alone. Confirm whether the ${travel.kind === "verified" ? money(travel.fee) + " " : ""}travel fee is included before sending.`,
    };
  }
  return { status: "ok", total, lines, note: "Agreed total used as-is; travel is not added on top." };
}

function travelLine(travel: TravelResolution, quoted: number | null): { line: PriceLine | null; problem: string | null } {
  if (travel.kind === "verified") {
    const line = { label: `Travel fee (${travel.place})`, amount: travel.fee };
    const problem = quoted !== null && quoted !== travel.fee
      ? `The thread states a ${money(quoted)} travel fee; the approved fee for ${travel.place} is ${money(travel.fee)}, which the contract uses. Confirm before sending.`
      : null;
    return { line, problem };
  }
  if (travel.kind === "unknown") {
    if (quoted !== null) return { line: { label: `Travel fee (${travel.place})`, amount: quoted }, problem: null };
    return { line: null, problem: `${travel.place} is outside San Francisco and no travel fee is verified or quoted for it.` };
  }
  return { line: null, problem: null };
}

function fromParts(session: number, extracted: ExtractedPricing, travel: TravelResolution): ContractPricing {
  const lines: PriceLine[] = [{ label: "Session", amount: session }, ...extracted.addOns];
  const { line, problem } = travelLine(travel, extracted.travelFee);
  if (line) lines.push(line);
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  if (problem) return { status: "review", total: line ? total : null, lines, reason: problem };
  return { status: "ok", total, lines, note: null };
}

export function resolveContractPricing(booking: ContractBooking, extracted: ExtractedPricing): ContractPricing {
  const travel = travelFor(booking);
  if (extracted.agreedTotal !== null && extracted.agreedTotal > 0) {
    return fromAgreedTotal(extracted.agreedTotal, extracted, travel, booking);
  }
  if (extracted.sessionPrice !== null && extracted.sessionPrice > 0) {
    return fromParts(extracted.sessionPrice, extracted, travel);
  }
  return {
    status: "review", total: null, lines: [],
    reason: "No agreed price was found in the thread. Enter the total before sending.",
  };
}

/** Turns the extractor's loose JSON into checked numbers. Anything unparseable is null. */
export function parseExtractedPricing(raw: Record<string, unknown>): ExtractedPricing {
  const amount = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 && n < 100_000 ? Math.round(n * 100) / 100 : null;
  };
  const addOns = Array.isArray(raw.addOns) ? raw.addOns : [];
  return {
    agreedTotal: amount(raw.agreedTotal),
    sessionPrice: amount(raw.sessionPrice),
    addOns: addOns.flatMap((a) => {
      const item = a as Record<string, unknown>;
      const value = amount(item?.amount);
      return value === null ? [] : [{ label: String(item.label ?? "Add-on").slice(0, 80), amount: value }];
    }),
    travelFee: amount(raw.travelFee),
    includesTravel: typeof raw.includesTravel === "boolean" ? raw.includesTravel : null,
  };
}
