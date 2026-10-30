// Builds the invoice the extension fills into Pixieset, from the inquiry and
// whatever the email thread settled. Nothing here guesses: a shoot somewhere
// the rate card has no fee for, a quoted figure that might or might not be the
// total, or a session with no catalog price all come back as "review".

import { BOOKING_POLICY, formatFee } from "../pricingCatalog";
import { resolveSession } from "./session";
import { resolveInvoiceLocation } from "./travel";
import {
  invoiceDraftSchema, NO_FACTS, type InvoiceDraft, type InvoiceInquiry, type InvoiceTravel, type SessionFacts,
} from "./types";

const money = (dollars: number) => formatFee(dollars);

interface Totals {
  baseCents: number | null;
  agreedTotalCents: number | null;
  totalCents: number | null;
  problems: string[];
}

function travelDue(travel: InvoiceTravel): boolean {
  return travel.kind === "verified" || travel.kind === "unknown";
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
  if (agreedCents === null) return { baseCents, agreedTotalCents: null, totalCents: catalogTotal, problems: [] };

  const place = travel.place ?? "the shoot location";
  if (agreedCents === catalogTotal) return { baseCents, agreedTotalCents: agreedCents, totalCents: catalogTotal, problems: [] };

  if (travel.kind === "verified" && agreedCents === baseCents && facts.includes_travel !== true) {
    return {
      baseCents, agreedTotalCents: agreedCents, totalCents: null,
      problems: [`The thread mentions ${money(facts.total_fee!)}, which matches the session price alone. Confirm whether the ${money(travelCents / 100)} travel fee for ${place} is included.`],
    };
  }
  const clearlyTotal = facts.total_kind === "agreed_total" && facts.confidence === "high";
  const consistent = !travelDue(travel) || facts.includes_travel === true;
  if (clearlyTotal && consistent && travel.kind !== "unknown" && agreedCents > travelCents) {
    return { baseCents: agreedCents - travelCents, agreedTotalCents: agreedCents, totalCents: agreedCents, problems: [] };
  }
  const kind = facts.total_kind === "agreed_total" ? "an agreed total" : facts.total_kind === "quote" ? "a quote" : "an amount";
  return {
    baseCents, agreedTotalCents: agreedCents, totalCents: null,
    problems: [`The thread states ${money(facts.total_fee!)} as ${kind}, which differs from the rate card (${catalogTotal === null ? "travel to " + place + " is unpriced" : money(catalogTotal / 100)}). Confirm the total before filling.`],
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
  if (where.travel.kind === "unknown") {
    reviewReasons.push(`${where.travel.place} is outside San Francisco and has no approved travel fee. Confirm the travel fee before filling.`);
  }
  const totals = session.baseCents === null
    ? { baseCents: 0, agreedTotalCents: null, totalCents: null, problems: [] }
    : applyAgreedTotal(session.baseCents, where.travel, facts);
  reviewReasons.push(...totals.problems);

  const when = dateFacts(inquiry, facts);
  const status = reviewReasons.length ? "review" : "ready";
  return {
    status,
    reviewReasons,
    warnings: when.warning ? [when.warning] : [],
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
