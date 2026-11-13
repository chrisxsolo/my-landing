// Builds the invoice the extension fills into Pixieset, from the inquiry and
// whatever the email thread settled. Nothing here guesses: a shoot somewhere
// the rate card has no fee for, a quoted figure that might or might not be the
// total, or a session with no catalog price all come back as "review".
// The money itself is worked out in ./totals.

import { formatReadable } from "../extension/sessionDates";
import { BOOKING_POLICY } from "../pricingCatalog";
import { isRealDate } from "./localTime";
import { resolveSession, type ResolvedSession, type SessionEvidence } from "./session";
import { resolveSessionTime } from "./sessionTime";
import type { SunsetResolution } from "./sunset";
import { priceSession, reviewDefaultedPackage } from "./totals";
import { isPlaceName, resolveInvoiceLocation, type InvoiceLocation } from "./travel";
import {
  invoiceDraftSchema, NO_FACTS, type InvoiceDraft, type InvoiceInquiry, type SessionFacts,
} from "./types";

type DateFacts = Pick<InvoiceDraft["session"], "date" | "dateConfidence" | "dateStatus"> & { warning: string | null };

const DUE_DATE_UNCHANGED = "Pixieset's due date is left unchanged.";

/**
 * The session date and how it stands. Only a date both sides settled in
 * email is "confirmed" and may become the due date; one that was asked for
 * and not yet accepted is kept, labelled "proposed", so it can be reviewed
 * instead of vanishing. The date's standing is its own: nothing about the
 * price or the thread as a whole promotes or demotes it.
 */
function dateFacts(inquiry: InvoiceInquiry, facts: SessionFacts): DateFacts {
  // A date that is not on the calendar (February 30th) is no date at all.
  const date = isRealDate(facts.date) ? facts.date : null;
  const fromThread = date !== null && facts.source === "email" && facts.date_status !== null;
  if (fromThread && facts.date_status === "confirmed") return { date, dateConfidence: "confirmed", dateStatus: "confirmed", warning: null };
  if (fromThread) {
    const standing = facts.date_status === "conflicting"
      ? `more than one date is still on the table (latest: ${formatReadable(date)})`
      : `${formatReadable(date)} was requested and has not been accepted yet`;
    return { date, dateConfidence: "tentative", dateStatus: facts.date_status ?? "proposed", warning: `The session date is not confirmed in email: ${standing}. ${DUE_DATE_UNCHANGED}` };
  }
  if (date || inquiry.date_in_mind) {
    return { date, dateConfidence: "tentative", dateStatus: "inquiry", warning: `The session date is not confirmed in email. ${DUE_DATE_UNCHANGED}` };
  }
  return { date: null, dateConfidence: "unknown", dateStatus: "unknown", warning: `No session date is known. ${DUE_DATE_UNCHANGED}` };
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

/** What could not be read, said plainly: missing context is never passed off as "nothing was said". */
function evidenceProblems(facts: SessionFacts): string[] {
  const coverage = facts.email_coverage;
  switch (facts.email_status) {
    case "unavailable":
      return ["Gmail is not connected or its messages could not be loaded, so the email thread was not read. Location, date and price come from the inquiry form only; reconnect Gmail in the admin or confirm them by hand."];
    case "partial":
      return ["Part of the email thread could not be loaded, so a later change may be missing. Check the thread, or reload the draft, before filling."];
    case "unparsed":
      return ["The email thread was read but could not be interpreted, so date, location and price come from the inquiry form only. Reload the draft or confirm them by hand."];
    default:
      return coverage?.omitted ? [`The email thread is long: ${coverage.omitted} older message${coverage.omitted === 1 ? " was" : "s were"} not read. Confirm nothing agreed earlier changes this draft.`] : [];
  }
}

/** Everything about the client, the thread and the place that must be checked before a fill. */
function contextProblems(inquiry: InvoiceInquiry, facts: SessionFacts, session: ResolvedSession, where: InvoiceLocation): string[] {
  const reasons = [...clientProblems(inquiry), ...session.problems, ...evidenceProblems(facts)];
  const storedNote = (inquiry.location ?? "").trim();
  if (storedNote && !facts.location && !isPlaceName(storedNote)) {
    reasons.push(`The inquiry's location field is a note, not a place: "${storedNote.slice(0, 120)}". Confirm the shoot location before filling.`);
  }
  if (where.travel.kind === "unknown") {
    reasons.push(`${where.travel.place} is outside San Francisco and has no approved travel fee. Confirm the travel fee before filling.`);
  }
  // A school never stands in for the venue of a senior or team session, so no location means travel was never checked.
  if (session.serviceKey === "senior-portraits" && !where.location) {
    reasons.push("No shoot location is known for this session, so travel could not be checked. Confirm the location before filling.");
  }
  return reasons;
}

function evidenceWarnings(facts: SessionFacts): string[] {
  const cut = facts.email_coverage?.truncated ?? 0;
  return cut ? [`${cut} long message${cut === 1 ? " was" : "s were"} read only in part.`] : [];
}

export interface InvoiceDraftOptions {
  /** Sunset for the session date in San Francisco, looked up by the caller. Tests inject a fixture. */
  sunset?: SunsetResolution | null;
}

/** What the thread adds about who is photographed and what was promised, as resolveSession takes it. */
export function sessionEvidenceFrom(facts: SessionFacts): SessionEvidence {
  return { people: facts.people, sportsTeamOffer: facts.sports_team_offer, deliverables: facts.deliverables };
}

function timeFor(facts: SessionFacts, when: DateFacts, where: InvoiceLocation, session: ResolvedSession, options: InvoiceDraftOptions) {
  return resolveSessionTime({
    time: facts.time, timeStatus: facts.time_status, date: when.date, dateConfidence: when.dateConfidence,
    location: where.location, locationSource: where.locationSource, travelKind: where.travel.kind,
    durationMinutes: session.durationMinutes, sunset: options.sunset ?? null,
  });
}

export function buildInvoiceDraft(inquiry: InvoiceInquiry, facts: SessionFacts = NO_FACTS, options: InvoiceDraftOptions = {}): InvoiceDraft {
  const session = resolveSession(inquiry, facts.session_type, facts.package, sessionEvidenceFrom(facts));
  const where = resolveInvoiceLocation({
    school: inquiry.school, location: inquiry.location, message: inquiry.message,
    emailLocation: facts.location, serviceKey: session.serviceKey,
  });
  const priced = priceSession(session, where.travel, facts);
  const addOn = priced.rush.kind === "add" || priced.rush.kind === "included";
  const pkg = reviewDefaultedPackage(session, priced.totals, where.travel, addOn ? priced.rush.amountCents ?? 0 : 0);
  const when = dateFacts(inquiry, facts);
  const time = timeFor(facts, when, where, session, options);
  const reviewReasons = [
    ...contextProblems(inquiry, facts, session, where), ...pkg.totals.problems, ...(pkg.problem ? [pkg.problem] : []), ...time.reviewReasons,
  ];
  return {
    status: reviewReasons.length ? "review" : "ready",
    reviewReasons,
    warnings: [...pkg.totals.notes, ...time.warnings, ...(when.warning ? [when.warning] : []), ...evidenceWarnings(facts)],
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
      dateStatus: when.dateStatus,
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
      baseConfirmed: pkg.totals.baseConfirmed && !pkg.problem,
    },
    note: buildNote(inquiry.name ?? ""),
    dueDate: when.dateStatus === "confirmed" ? when.date : null,
  };
}

/** The draft as the extension must receive it, or the first reason it is malformed. */
export function validateInvoiceDraft(draft: unknown): { ok: true; draft: InvoiceDraft } | { ok: false; error: string } {
  const parsed = invoiceDraftSchema.safeParse(draft);
  if (parsed.success) return { ok: true, draft: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, error: `${issue.path.join(".") || "draft"}: ${issue.message}` };
}
