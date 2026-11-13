// The invoice's money: the rate card, a figure the thread settled, and the
// Rush preview add-on, resolved into one set of totals. Nothing here guesses.
// A figure that might or might not be the total, a package nobody chose and a
// service with no rate-card price all come back unconfirmed, with the reason.
//
// Whether a thread figure counts is decided by that figure's own standing
// (total_kind and total_status). The thread's date, time and overall
// "confidence" never enter into it: a session date that is still only a
// request does not make an agreed price uncertain.

import { resolveRushPreview, type RushPreviewCharge } from "../extension/rushPreview";
import { PRICING_CATALOG, formatFee } from "../pricingCatalog";
import type { BaseOption, ResolvedSession } from "./session";
import type { InvoiceTravel, SessionFacts } from "./types";

const money = (dollars: number) => formatFee(dollars);

export interface Totals {
  baseCents: number | null;
  agreedTotalCents: number | null;
  totalCents: number | null;
  problems: string[];
  notes: string[];
  /** False when the price itself is unsettled; baseCents is then a reference figure, never something to fill. */
  baseConfirmed: boolean;
}

/** The thread plainly called the figure the total, and the photographer is on record for it. */
function totalSettled(facts: SessionFacts): boolean {
  return facts.total_fee !== null && facts.total_kind === "agreed_total" && facts.total_status === "confirmed";
}

function travelDue(travel: InvoiceTravel): boolean {
  return travel.kind === "verified" || travel.kind === "unknown";
}

/** Every campus travel fee on the rate card, in cents. */
const CAMPUS_FEE_CENTS = new Set(
  Object.values(PRICING_CATALOG.graduation.travelFees)
    .filter((fee): fee is number => typeof fee === "number")
    .map((fee) => fee * 100),
);

/**
 * A thread total that is exactly the session price plus a campus travel fee,
 * for a shoot now inside San Francisco: the earlier quote assumed the campus
 * (Anthony's $675 = $600 + SJSU $75, before City Hall was chosen). The rate
 * card total stands and the old quote is noted for the reviewer.
 */
function supersededCampusQuote(agreedCents: number, baseCents: number, travel: InvoiceTravel): boolean {
  return travel.kind === "included" && CAMPUS_FEE_CENTS.has(agreedCents - baseCents);
}

/**
 * Whether a figure from the thread may replace the rate card. Only an amount
 * the thread plainly called the total and the photographer confirmed,
 * consistent with where the shoot is, is accepted on its own; anything else
 * is a review item.
 *
 * `shiftCents` is an add-on the client chose after the figure was written:
 * the figure is compared with the rate card as figure + add-on, while the
 * reviewer still reads the figure the thread actually wrote. A figure the
 * thread said already includes an add-on is never read as a stale campus
 * quote (`staleCampusQuote: false`): "$900 with rush preview and the extra
 * outfit" is a negotiated total, not $825 plus SJSU travel.
 */
interface AgreedTotalOptions { shiftCents?: number; staleCampusQuote?: boolean }

function applyAgreedTotal(baseCents: number, travel: InvoiceTravel, facts: SessionFacts, options: AgreedTotalOptions = {}): Totals {
  const shiftCents = options.shiftCents ?? 0;
  const threadCents = facts.total_fee === null ? null : Math.round(facts.total_fee * 100);
  const travelCents = travel.amountCents ?? 0;
  const catalogTotal = travel.kind === "unknown" ? null : baseCents + travelCents;
  const rateCard = { baseCents, totalCents: catalogTotal, problems: [], notes: [], baseConfirmed: true };
  if (threadCents === null) return { ...rateCard, agreedTotalCents: null };

  const agreedCents = threadCents + shiftCents;
  const stated = shiftCents ? `${money(threadCents / 100)} + ${money(shiftCents / 100)} Rush preview` : money(threadCents / 100);
  const place = travel.place ?? "the shoot location";
  if (agreedCents === catalogTotal) return { ...rateCard, agreedTotalCents: threadCents };
  if (options.staleCampusQuote !== false && supersededCampusQuote(agreedCents, baseCents, travel)) {
    return {
      ...rateCard, agreedTotalCents: null,
      notes: [`The thread's ${stated} quote included a ${money((agreedCents - baseCents) / 100)} campus travel fee. The shoot is at ${place}, where travel is included, so the invoice uses ${money(catalogTotal! / 100)}.`],
    };
  }

  const contested = { baseCents, agreedTotalCents: threadCents, totalCents: null, notes: [], baseConfirmed: false };
  if (travel.kind === "verified" && agreedCents === baseCents && facts.includes_travel !== true) {
    return { ...contested, problems: [`The thread mentions ${stated}, which matches the session price alone. Confirm whether the ${money(travelCents / 100)} travel fee for ${place} is included.`] };
  }
  // A total said to include travel, for a shoot with no travel fee, carries a
  // fee for somewhere else; it is never taken as-is.
  const consistent = travelDue(travel) ? facts.includes_travel === true : facts.includes_travel !== true;
  if (totalSettled(facts) && consistent && travel.kind !== "unknown" && agreedCents > travelCents) {
    return { baseCents: agreedCents - travelCents, agreedTotalCents: threadCents, totalCents: agreedCents, problems: [], notes: [], baseConfirmed: true };
  }
  return {
    ...contested,
    problems: [`The thread states ${stated} as ${figureStanding(facts)}, which differs from the rate card (${catalogTotal === null ? "travel to " + place + " is unpriced" : money(catalogTotal / 100)}). Confirm the total before filling.`],
  };
}

/** How the thread's figure stands, in the reviewer's words. */
function figureStanding(facts: SessionFacts): string {
  const kind = facts.total_kind === "agreed_total" ? "an agreed total" : facts.total_kind === "quote" ? "a quote" : "an amount";
  if (facts.total_kind !== "agreed_total" || facts.total_status === "confirmed" || facts.total_status === null) return kind;
  return facts.total_status === "conflicting" ? "a total that is still being discussed" : "a total the photographer has not confirmed";
}

const UNPRICED: Totals = { baseCents: 0, agreedTotalCents: null, totalCents: null, problems: [], notes: [], baseConfirmed: false };

/**
 * A session quoted per booking (senior portraits, nine or more graduates, a
 * type the rate card does not name). There is no rate card to compare with,
 * so a total the thread settled is the price; anything short of settled
 * leaves the price empty for a person, with the figure the thread mentioned.
 * Travel is never invented: a settled total stands as written, and the
 * reviewer is asked about travel only where a fee is actually on file.
 */
function negotiatedTotals(session: ResolvedSession, travel: InvoiceTravel, facts: SessionFacts): Totals {
  const threadCents = facts.total_fee === null ? null : Math.round(facts.total_fee * 100);
  const reason = session.handQuoted?.reason ?? null;
  if (threadCents === null || !totalSettled(facts)) {
    const seen = threadCents === null ? null : `The thread mentions ${money(threadCents / 100)} as ${figureStanding(facts)}, which is not a settled total. Confirm the price before filling.`;
    return { ...UNPRICED, agreedTotalCents: threadCents, problems: [reason, seen].filter((text): text is string => Boolean(text)) };
  }
  const stated = money(threadCents / 100);
  const place = travel.place ?? "the shoot location";
  const travelCents = travel.amountCents ?? 0;
  const whole: Totals = { baseCents: threadCents, agreedTotalCents: threadCents, totalCents: threadCents, problems: [], notes: [], baseConfirmed: true };
  if (travel.kind === "verified") {
    if (facts.includes_travel === true && threadCents > travelCents) return { ...whole, baseCents: threadCents - travelCents };
    return { ...UNPRICED, agreedTotalCents: threadCents, problems: [`The thread settled ${stated} as the total. Confirm whether the ${money(travelCents / 100)} travel fee for ${place} is included in it.`] };
  }
  if (travel.kind === "unknown" && facts.includes_travel === false) {
    return { ...UNPRICED, agreedTotalCents: threadCents, problems: [`The thread settled ${stated} and says travel is extra, but ${place} has no approved travel fee. Confirm the total before filling.`] };
  }
  const note = `The session line is the ${stated} total agreed in email; no rate-card price applies to this session.`;
  return { ...whole, notes: [note] };
}

/** The reviewer's line for an add-on that is inside the session price. */
function rushPreviewNote(rush: RushPreviewCharge, facts: SessionFacts): string {
  if (rush.kind === "included") return rush.note ?? "";
  const chosen = facts.rush_preview.source === "inquiry" ? "selected on the inquiry form" : "asked for in email";
  return `Includes the ${money((rush.amountCents ?? 0) / 100)} ${rush.label} add-on the client ${chosen}.`;
}

/**
 * The evidence names more than one package, so none is priced. A figure in
 * the thread never breaks the tie: $325 could be the mini, a retainer or a
 * negotiated hour, and only a person can say which.
 */
function undecidedPackage(options: BaseOption[], facts: SessionFacts): Totals {
  const named = options.map((option) => `${option.label} ${money(option.baseCents / 100)}`).join(" or ");
  return {
    ...UNPRICED, agreedTotalCents: facts.total_fee === null ? null : Math.round(facts.total_fee * 100),
    problems: [`The package is one of: ${named}. The total stays blank until it is confirmed.`],
  };
}

function baseTotals(session: ResolvedSession, travel: InvoiceTravel, facts: SessionFacts, rush: RushPreviewCharge): Totals {
  const addOnCents = rush.kind === "add" || rush.kind === "included" ? rush.amountCents ?? 0 : 0;
  // For a hand-quoted session the settled total is the price, whatever the rate card or an offer would say.
  if (session.handQuoted && (totalSettled(facts) || (session.baseCents === null && session.baseOptions.length <= 1))) {
    return negotiatedTotals(session, travel, facts);
  }
  if (session.baseCents !== null) {
    return applyAgreedTotal(session.baseCents + addOnCents, travel, facts, { shiftCents: rush.kind === "add" ? addOnCents : 0, staleCampusQuote: rush.kind !== "included" });
  }
  return session.baseOptions.length > 1 ? undecidedPackage(session.baseOptions, facts) : UNPRICED;
}

/**
 * The session's money, with the Rush preview add-on resolved first. An
 * add-on the thread settled joins the nontravel base (the description names
 * it); a figure written before the add-on is compared with the rate card as
 * figure + add-on, so $750 then Rush preview lands on $825 and is never read
 * as a stale $75 campus fee. Unresolved add-on evidence blanks the total.
 */
export function priceSession(session: ResolvedSession, travel: InvoiceTravel, facts: SessionFacts): { totals: Totals; rush: RushPreviewCharge } {
  const rush = resolveRushPreview(facts, { serviceKey: session.serviceKey, baseCents: session.baseCents, travelCents: travel.amountCents ?? 0 });
  const addOn = rush.kind === "add" || rush.kind === "included";
  let totals = baseTotals(session, travel, facts, rush);
  if (rush.kind === "review") totals = { ...totals, totalCents: null, baseConfirmed: false, problems: [...totals.problems, rush.note ?? ""] };
  else if (addOn && rush.amountCents) totals = { ...totals, notes: [...totals.notes, rushPreviewNote(rush, facts)] };
  return { totals, rush };
}

const MINI_CENTS = PRICING_CATALOG.graduation.packages.mini.price * 100;

export interface PackageReview { note: string | null; problem: string | null; totals: Totals }

/**
 * A defaulted package next to money from the thread. The default was not the
 * client's choice, so a figure that disagrees with it is held to a higher
 * bar than applyAgreedTotal's: it is named as negotiated only when it could
 * not be the mini in disguise. Below the mini price, or exactly the mini
 * plus a campus fee for a shoot now in the city, the total is blanked for a
 * person. The price alone never makes the booking a mini.
 */
export function reviewDefaultedPackage(session: ResolvedSession, totals: Totals, travel: InvoiceTravel, addOnCents: number): PackageReview {
  const untouched = { note: session.packageNote, problem: null, totals };
  if (session.packageSource !== "default" || session.baseCents === null || totals.agreedTotalCents === null) return untouched;
  const rateCardBase = session.baseCents + addOnCents;
  const agreedBase = totals.agreedTotalCents - (travel.amountCents ?? 0);
  const mini = money(MINI_CENTS / 100);
  const blanked = { ...totals, baseCents: rateCardBase, totalCents: null, baseConfirmed: false };
  if (totals.totalCents === null) {
    const problem = agreedBase === MINI_CENTS ? `${mini} is also the Graduation Mini price, but the thread never chose the mini. If the mini was booked, change the item, description and price; otherwise confirm the total.` : null;
    return { ...untouched, problem };
  }
  if (totals.baseCents === rateCardBase) return untouched;
  const stated = money(totals.agreedTotalCents / 100);
  if (travel.kind === "included" && CAMPUS_FEE_CENTS.has(agreedBase - MINI_CENTS)) {
    return { note: session.packageNote, totals: blanked, problem: `The thread's ${stated} equals the ${mini} Graduation Mini plus a ${money((agreedBase - MINI_CENTS) / 100)} campus travel fee, and the shoot is now where travel is included. Confirm the package and the total before filling.` };
  }
  if (agreedBase < MINI_CENTS) {
    return { note: session.packageNote, totals: blanked, problem: `The thread's ${stated} is below every graduation package (${mini} mini), and no package was chosen. Confirm the total before filling.` };
  }
  return { ...untouched, note: `${session.packageNote} · negotiated price ${money((totals.baseCents ?? 0) / 100)} agreed in email (rate card ${money(session.baseCents / 100)})` };
}
