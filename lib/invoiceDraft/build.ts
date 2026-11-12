// Builds the invoice the extension fills into Pixieset, from the inquiry and
// whatever the email thread settled. Nothing here guesses: a shoot somewhere
// the rate card has no fee for, a quoted figure that might or might not be the
// total, or a session with no catalog price all come back as "review".

import { resolveRushPreview, type RushPreviewCharge } from "../extension/rushPreview";
import { BOOKING_POLICY, PRICING_CATALOG, formatFee } from "../pricingCatalog";
import { isRealDate } from "./localTime";
import { resolveSession, type BaseOption, type ResolvedSession } from "./session";
import { resolveSessionTime } from "./sessionTime";
import type { SunsetResolution } from "./sunset";
import { isPlaceName, resolveInvoiceLocation, type InvoiceLocation } from "./travel";
import {
  invoiceDraftSchema, NO_FACTS, type InvoiceDraft, type InvoiceInquiry, type InvoiceTravel, type SessionFacts,
} from "./types";

const money = (dollars: number) => formatFee(dollars);

interface Totals {
  baseCents: number | null;
  agreedTotalCents: number | null;
  totalCents: number | null;
  problems: string[];
  notes: string[];
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
 * the thread plainly called the total, consistent with where the shoot is,
 * is accepted on its own; anything else is a review item.
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
  if (threadCents === null) return { baseCents, agreedTotalCents: null, totalCents: catalogTotal, problems: [], notes: [] };

  const agreedCents = threadCents + shiftCents;
  const stated = shiftCents ? `${money(threadCents / 100)} + ${money(shiftCents / 100)} Rush preview` : money(threadCents / 100);
  const place = travel.place ?? "the shoot location";
  if (agreedCents === catalogTotal) return { baseCents, agreedTotalCents: threadCents, totalCents: catalogTotal, problems: [], notes: [] };
  if (options.staleCampusQuote !== false && supersededCampusQuote(agreedCents, baseCents, travel)) {
    return {
      baseCents, agreedTotalCents: null, totalCents: catalogTotal, problems: [],
      notes: [`The thread's ${stated} quote included a ${money((agreedCents - baseCents) / 100)} campus travel fee. The shoot is at ${place}, where travel is included, so the invoice uses ${money(catalogTotal! / 100)}.`],
    };
  }

  if (travel.kind === "verified" && agreedCents === baseCents && facts.includes_travel !== true) {
    return {
      baseCents, agreedTotalCents: threadCents, totalCents: null,
      problems: [`The thread mentions ${stated}, which matches the session price alone. Confirm whether the ${money(travelCents / 100)} travel fee for ${place} is included.`],
      notes: [],
    };
  }
  const clearlyTotal = facts.total_kind === "agreed_total" && facts.confidence === "high";
  // A total said to include travel, for a shoot with no travel fee, carries a
  // fee for somewhere else; it is never taken as-is.
  const consistent = travelDue(travel) ? facts.includes_travel === true : facts.includes_travel !== true;
  if (clearlyTotal && consistent && travel.kind !== "unknown" && agreedCents > travelCents) {
    return { baseCents: agreedCents - travelCents, agreedTotalCents: threadCents, totalCents: agreedCents, problems: [], notes: [] };
  }
  const kind = facts.total_kind === "agreed_total" ? "an agreed total" : facts.total_kind === "quote" ? "a quote" : "an amount";
  return {
    baseCents, agreedTotalCents: threadCents, totalCents: null,
    problems: [`The thread states ${stated} as ${kind}, which differs from the rate card (${catalogTotal === null ? "travel to " + place + " is unpriced" : money(catalogTotal / 100)}). Confirm the total before filling.`],
    notes: [],
  };
}

const EMPTY_TOTALS: Totals = { baseCents: 0, agreedTotalCents: null, totalCents: null, problems: [], notes: [] };

/** The reviewer's line for an add-on that is inside the session price. */
function rushPreviewNote(rush: RushPreviewCharge, facts: SessionFacts): string {
  if (rush.kind === "included") return rush.note ?? "";
  const chosen = facts.rush_preview.source === "inquiry" ? "selected on the inquiry form" : "asked for in email";
  return `Includes the ${money((rush.amountCents ?? 0) / 100)} ${rush.label} add-on the client ${chosen}.`;
}

/**
 * The session's money, with the Rush preview add-on resolved first. An
 * add-on the thread settled joins the nontravel base (the description names
 * it); a figure written before the add-on is compared with the rate card as
 * figure + add-on, so $750 then Rush preview lands on $825 and is never read
 * as a stale $75 campus fee. Unresolved add-on evidence blanks the total.
 */
function priceSession(session: ResolvedSession, travel: InvoiceTravel, facts: SessionFacts): { totals: Totals; rush: RushPreviewCharge } {
  const rush = resolveRushPreview(facts, { serviceKey: session.serviceKey, baseCents: session.baseCents, travelCents: travel.amountCents ?? 0 });
  const addOnCents = rush.kind === "add" || rush.kind === "included" ? rush.amountCents ?? 0 : 0;
  const options = { shiftCents: rush.kind === "add" ? addOnCents : 0, staleCampusQuote: rush.kind !== "included" };
  let totals = session.baseCents !== null
    ? applyAgreedTotal(session.baseCents + addOnCents, travel, facts, options)
    : session.baseOptions.length > 1 ? undecidedPackage(session.baseOptions, facts) : EMPTY_TOTALS;
  if (rush.kind === "review") totals = { ...totals, totalCents: null, problems: [...totals.problems, rush.note ?? ""] };
  else if (addOnCents) totals = { ...totals, notes: [...totals.notes, rushPreviewNote(rush, facts)] };
  return { totals, rush };
}

/**
 * The evidence names more than one package, so none is priced. A figure in
 * the thread never breaks the tie: $325 could be the mini, a retainer or a
 * negotiated hour, and only a person can say which.
 */
function undecidedPackage(options: BaseOption[], facts: SessionFacts): Totals {
  const named = options.map((option) => `${option.label} ${money(option.baseCents / 100)}`).join(" or ");
  return {
    baseCents: 0, agreedTotalCents: facts.total_fee === null ? null : Math.round(facts.total_fee * 100), totalCents: null,
    problems: [`The package is one of: ${named}. The total stays blank until it is confirmed.`], notes: [],
  };
}

const MINI_CENTS = PRICING_CATALOG.graduation.packages.mini.price * 100;

interface PackageReview { note: string | null; problem: string | null; totals: Totals }

/**
 * A defaulted package next to money from the thread. The default was not the
 * client's choice, so a figure that disagrees with it is held to a higher
 * bar than applyAgreedTotal's: it is named as negotiated only when it could
 * not be the mini in disguise. Below the mini price, or exactly the mini
 * plus a campus fee for a shoot now in the city, the total is blanked for a
 * person. The price alone never makes the booking a mini.
 */
function reviewDefaultedPackage(session: ResolvedSession, totals: Totals, travel: InvoiceTravel, addOnCents: number): PackageReview {
  const untouched = { note: session.packageNote, problem: null, totals };
  if (session.packageSource !== "default" || session.baseCents === null || totals.agreedTotalCents === null) return untouched;
  const rateCardBase = session.baseCents + addOnCents;
  const agreedBase = totals.agreedTotalCents - (travel.amountCents ?? 0);
  const mini = money(MINI_CENTS / 100);
  const blanked = { ...totals, baseCents: rateCardBase, totalCents: null };
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

function dateFacts(inquiry: InvoiceInquiry, facts: SessionFacts): { date: string | null; dateConfidence: InvoiceDraft["session"]["dateConfidence"]; warning: string | null } {
  // A date that is not on the calendar (February 30th) is no date at all.
  const date = isRealDate(facts.date) ? facts.date : null;
  if (date && facts.source === "email" && facts.confidence === "high") {
    return { date, dateConfidence: "confirmed", warning: null };
  }
  if (date || inquiry.date_in_mind) {
    return { date, dateConfidence: "tentative", warning: "The session date is not confirmed in email. Pixieset's due date is left unchanged." };
  }
  return { date: null, dateConfidence: "unknown", warning: "No session date is known. Pixieset's due date is left unchanged." };
}

function buildNote(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return `Thank you for booking, ${first}! A ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves your session, and the remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`;
}

function clientProblems(inquiry: InvoiceInquiry): string[] {
  const problems: string[] = [];
  if (!inquiry.name?.trim()) problems.push("The inquiry has no client name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email ?? "")) problems.push("The inquiry has no usable email address, so the Pixieset client cannot be matched.");
  return problems;
}

/** Everything about the client, the thread and the place that must be checked before a fill. */
function contextProblems(inquiry: InvoiceInquiry, facts: SessionFacts, session: ResolvedSession, where: InvoiceLocation): string[] {
  const reasons = [...clientProblems(inquiry), ...session.problems];
  if (facts.email_status === "unavailable") {
    reasons.push("Gmail is not connected, so the email thread was not read. Location, date and price come from the inquiry form only; reconnect Gmail in the admin or confirm them by hand.");
  }
  const storedNote = (inquiry.location ?? "").trim();
  if (storedNote && !facts.location && !isPlaceName(storedNote)) {
    reasons.push(`The inquiry's location field is a note, not a place: "${storedNote.slice(0, 120)}". Confirm the shoot location before filling.`);
  }
  if (where.travel.kind === "unknown") {
    reasons.push(`${where.travel.place} is outside San Francisco and has no approved travel fee. Confirm the travel fee before filling.`);
  }
  return reasons;
}

export interface InvoiceDraftOptions {
  /** Sunset for the session date in San Francisco, looked up by the caller. Tests inject a fixture. */
  sunset?: SunsetResolution | null;
}

export function buildInvoiceDraft(inquiry: InvoiceInquiry, facts: SessionFacts = NO_FACTS, options: InvoiceDraftOptions = {}): InvoiceDraft {
  const session = resolveSession(inquiry, facts.session_type, facts.package);
  const where = resolveInvoiceLocation({
    school: inquiry.school, location: inquiry.location, message: inquiry.message,
    emailLocation: facts.location, serviceKey: session.serviceKey,
  });
  const priced = priceSession(session, where.travel, facts);
  const addOn = priced.rush.kind === "add" || priced.rush.kind === "included";
  const pkg = reviewDefaultedPackage(session, priced.totals, where.travel, addOn ? priced.rush.amountCents ?? 0 : 0);
  const when = dateFacts(inquiry, facts);
  const time = resolveSessionTime({
    time: facts.time, timeStatus: facts.time_status, date: when.date, dateConfidence: when.dateConfidence,
    location: where.location, locationSource: where.locationSource, travelKind: where.travel.kind,
    durationMinutes: session.durationMinutes, sunset: options.sunset ?? null,
  });
  const reviewReasons = [
    ...contextProblems(inquiry, facts, session, where), ...pkg.totals.problems, ...(pkg.problem ? [pkg.problem] : []), ...time.reviewReasons,
  ];
  return {
    status: reviewReasons.length ? "review" : "ready",
    reviewReasons,
    warnings: [...pkg.totals.notes, ...time.warnings, ...(when.warning ? [when.warning] : [])],
    client: { inquiryId: inquiry.id, name: inquiry.name ?? "", email: inquiry.email ?? "" },
    session: {
      serviceKey: session.serviceKey ?? "unknown",
      itemName: session.itemName,
      description: addOn ? `${session.description} + ${priced.rush.label}` : session.description,
      quantity: 1,
      people: session.people,
      school: inquiry.school?.trim() || null,
      location: where.location,
      locationSource: where.locationSource,
      date: when.date,
      dateConfidence: when.dateConfidence,
      time: time.time,
      timeDetail: time.detail,
      durationMinutes: session.durationMinutes,
      packageSource: session.packageSource,
      packageNote: pkg.note,
    },
    pricing: {
      currency: "USD",
      baseCents: pkg.totals.baseCents ?? 0,
      travel: where.travel,
      agreedTotalCents: pkg.totals.agreedTotalCents,
      totalCents: pkg.totals.totalCents,
    },
    note: buildNote(inquiry.name ?? ""),
    dueDate: when.dateConfidence === "confirmed" ? when.date : null,
  };
}

/** The draft as the extension must receive it, or the first reason it is malformed. */
export function validateInvoiceDraft(draft: unknown): { ok: true; draft: InvoiceDraft } | { ok: false; error: string } {
  const parsed = invoiceDraftSchema.safeParse(draft);
  if (parsed.success) return { ok: true, draft: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, error: `${issue.path.join(".") || "draft"}: ${issue.message}` };
}
