// Builds the invoice the extension fills into Pixieset, from the inquiry and
// whatever the email thread settled. Nothing here guesses: a shoot somewhere
// the rate card has no fee for, a quoted figure that might or might not be the
// total, or a session with no catalog price all come back as "review".

import { BOOKING_POLICY, PRICING_CATALOG, formatFee } from "../pricingCatalog";
import { resolveSession } from "./session";
import { isPlaceName, resolveInvoiceLocation } from "./travel";
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
 */
function applyAgreedTotal(baseCents: number, travel: InvoiceTravel, facts: SessionFacts): Totals {
  const agreedCents = facts.total_fee === null ? null : Math.round(facts.total_fee * 100);
  const travelCents = travel.amountCents ?? 0;
  const catalogTotal = travel.kind === "unknown" ? null : baseCents + travelCents;
  if (agreedCents === null) return { baseCents, agreedTotalCents: null, totalCents: catalogTotal, problems: [], notes: [] };

  const place = travel.place ?? "the shoot location";
  if (agreedCents === catalogTotal) return { baseCents, agreedTotalCents: agreedCents, totalCents: catalogTotal, problems: [], notes: [] };
  if (supersededCampusQuote(agreedCents, baseCents, travel)) {
    return {
      baseCents, agreedTotalCents: null, totalCents: catalogTotal, problems: [],
      notes: [`The thread's ${money(facts.total_fee!)} quote included a ${money((agreedCents - baseCents) / 100)} campus travel fee. The shoot is at ${place}, where travel is included, so the invoice uses ${money(catalogTotal! / 100)}.`],
    };
  }

  if (travel.kind === "verified" && agreedCents === baseCents && facts.includes_travel !== true) {
    return {
      baseCents, agreedTotalCents: agreedCents, totalCents: null,
      problems: [`The thread mentions ${money(facts.total_fee!)}, which matches the session price alone. Confirm whether the ${money(travelCents / 100)} travel fee for ${place} is included.`],
      notes: [],
    };
  }
  const clearlyTotal = facts.total_kind === "agreed_total" && facts.confidence === "high";
  // A total said to include travel, for a shoot with no travel fee, carries a
  // fee for somewhere else; it is never taken as-is.
  const consistent = travelDue(travel) ? facts.includes_travel === true : facts.includes_travel !== true;
  if (clearlyTotal && consistent && travel.kind !== "unknown" && agreedCents > travelCents) {
    return { baseCents: agreedCents - travelCents, agreedTotalCents: agreedCents, totalCents: agreedCents, problems: [], notes: [] };
  }
  const kind = facts.total_kind === "agreed_total" ? "an agreed total" : facts.total_kind === "quote" ? "a quote" : "an amount";
  return {
    baseCents, agreedTotalCents: agreedCents, totalCents: null,
    problems: [`The thread states ${money(facts.total_fee!)} as ${kind}, which differs from the rate card (${catalogTotal === null ? "travel to " + place + " is unpriced" : money(catalogTotal / 100)}). Confirm the total before filling.`],
    notes: [],
  };
}

function dateFacts(inquiry: InvoiceInquiry, facts: SessionFacts): { date: string | null; dateConfidence: InvoiceDraft["session"]["dateConfidence"]; warning: string | null } {
  if (facts.date && facts.source === "email" && facts.confidence === "high") {
    return { date: facts.date, dateConfidence: "confirmed", warning: null };
  }
  const date = facts.date ?? null;
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

export function buildInvoiceDraft(inquiry: InvoiceInquiry, facts: SessionFacts = NO_FACTS): InvoiceDraft {
  const session = resolveSession(inquiry, facts.session_type);
  const where = resolveInvoiceLocation({
    school: inquiry.school, location: inquiry.location, message: inquiry.message,
    emailLocation: facts.location, serviceKey: session.serviceKey,
  });
  const reviewReasons = [...clientProblems(inquiry), ...session.problems];
  if (facts.email_status === "unavailable") {
    reviewReasons.push("Gmail is not connected, so the email thread was not read. Location, date and price come from the inquiry form only; reconnect Gmail in the admin or confirm them by hand.");
  }
  const storedNote = (inquiry.location ?? "").trim();
  if (storedNote && !facts.location && !isPlaceName(storedNote)) {
    reviewReasons.push(`The inquiry's location field is a note, not a place: "${storedNote.slice(0, 120)}". Confirm the shoot location before filling.`);
  }
  if (where.travel.kind === "unknown") {
    reviewReasons.push(`${where.travel.place} is outside San Francisco and has no approved travel fee. Confirm the travel fee before filling.`);
  }
  const totals = session.baseCents === null
    ? { baseCents: 0, agreedTotalCents: null, totalCents: null, problems: [], notes: [] }
    : applyAgreedTotal(session.baseCents, where.travel, facts);
  reviewReasons.push(...totals.problems);

  const when = dateFacts(inquiry, facts);
  const status = reviewReasons.length ? "review" : "ready";
  return {
    status,
    reviewReasons,
    warnings: [...totals.notes, ...(when.warning ? [when.warning] : [])],
    client: { inquiryId: inquiry.id, name: inquiry.name ?? "", email: inquiry.email ?? "" },
    session: {
      serviceKey: session.serviceKey ?? "unknown",
      itemName: session.itemName,
      description: session.description,
      quantity: 1,
      people: session.people,
      school: inquiry.school?.trim() || null,
      location: where.location,
      locationSource: where.locationSource,
      date: when.date,
      dateConfidence: when.dateConfidence,
      time: facts.time,
    },
    pricing: {
      currency: "USD",
      baseCents: totals.baseCents ?? 0,
      travel: where.travel,
      agreedTotalCents: totals.agreedTotalCents,
      totalCents: totals.totalCents,
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
