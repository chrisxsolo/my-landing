// SoloXSnaps → PixiSet Autofill: the server's resolution of a booking, for the
// contract preview. /api/extension/detect-date returns, as `resolved`, the
// same draft /api/extension/invoice-draft builds for the invoice. Reading the
// contract's type, date, time, place and total from it means the two
// documents show one decision; the browser prices nothing when it is present.
// An older API has no `resolved`, and the preview falls back to calcPrice.

const DATE_STATUS_LABELS = {
  confirmed: "confirmed in email",
  proposed: "requested in email, not yet confirmed",
  conflicting: "still open: more than one date is on the table",
  inquiry: "from the inquiry form, not confirmed in email",
  unknown: "not known",
};
const MAX_RESOLVED_CENTS = 10000000;
const MAX_RESOLVED_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 400;
const UNSETTLED_TOTAL_HINT = "The total is not settled. Enter it once it is agreed.";

// The server's draft, checked field by field before anything is shown or
// filled. A payload that is not a draft is ignored (null), never guessed at.
function normalizeResolved(raw) {
  if (!raw || typeof raw !== "object" || !raw.session || !raw.pricing) return null;
  const session = raw.session, pricing = raw.pricing;
  if (typeof session !== "object" || typeof pricing !== "object" || typeof session.serviceKey !== "string") return null;
  const text = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const cents = v => (Number.isInteger(v) && v >= 0 && v <= MAX_RESOLVED_CENTS ? v : null);
  const messages = v => (Array.isArray(v) ? v.filter(m => typeof m === "string").slice(0, MAX_RESOLVED_MESSAGES).map(m => m.slice(0, MAX_MESSAGE_CHARS)) : []);
  return {
    serviceKey: text(session.serviceKey, 40),
    date: /^\d{4}-\d{2}-\d{2}$/.test(session.date || "") ? session.date : null,
    dateStatus: DATE_STATUS_LABELS[session.dateStatus] ? session.dateStatus : "unknown",
    time: text(session.time, 60) || null,
    timeStatus: text(session.timeDetail && session.timeDetail.status, 20) || null,
    location: text(session.location, 120) || null,
    totalCents: cents(pricing.totalCents),
    reviewReasons: messages(raw.reviewReasons),
    warnings: messages(raw.warnings),
  };
}

// The service the contract names. The server's "unknown" is a session the
// rate card does not name: "Photo Session", never a graduation.
function resolvedService(resolved) {
  return resolved.serviceKey === "unknown" ? "other" : resolved.serviceKey;
}

// Contract money from the server's draft, split 50/50 like the invoice's
// retainer. A total the server would not give stays empty, with its reasons:
// the browser never substitutes a figure of its own for one the server refused.
function priceFromResolved(resolved) {
  const subtotal = resolved.totalCents == null ? null : resolved.totalCents / 100;
  const deposit = subtotal == null ? null : subtotal / 2;
  const reasons = resolved.reviewReasons.join(" ");
  return {
    service: resolvedService(resolved), subtotal, deposit, remaining: subtotal == null ? null : subtotal - deposit,
    reviewHint: reasons || (subtotal == null ? UNSETTLED_TOTAL_HINT : null),
    priceNote: resolved.warnings.filter(w => !/due date/i.test(w)).join(" ") || null,
    fromServer: true,
  };
}

const UNCHECKED_THREAD_HINT = "The email thread could not be checked, so no total is filled in. Try again, or enter the agreed total by hand.";

// The contract's money when the thread could not be checked: none. The
// browser does not fall back to its own pricing behind a failed lookup.
function unpricedContract(inq) {
  return { service: detectServiceType(inq), subtotal: null, deposit: null, remaining: null, reviewHint: UNCHECKED_THREAD_HINT, priceNote: null, fromServer: true };
}

// Whether the preview has something flagged that must be ticked off before a
// fill: a reason from the server, or a session date that is not confirmed.
function contractNeedsConfirmation(inq, price) {
  return Boolean(price.fromServer && (price.reviewHint || contractDateNote(inq)));
}

// The inquiry with what the server resolved. Each value keeps its standing:
// a date that was only requested is filled in for review and labelled, never
// hidden as "TBD" and never called confirmed.
function enrichInquiryFromResolved(inq, d, resolved) {
  const legacy = enrichInquiryFromFacts(inq, d);
  return {
    ...legacy,
    _sessionDate: (resolved.date && formatSessionDate(resolved.date)) || legacy._sessionDate,
    _dateStatus: resolved.date ? resolved.dateStatus : (legacy._sessionDate === "TBD" ? "unknown" : "inquiry"),
    // A time the server could not resolve (a bare "golden hour") is not written into a contract.
    _sessionTime: resolved.time || (resolved.timeStatus === "unresolved" ? "TBD" : legacy._sessionTime),
    _timeStatus: resolved.timeStatus,
    _location: resolved.location || legacy._location,
    _serviceType: resolvedService(resolved),
  };
}

// One line under the title: the service, how the date and time stand, and the total.
function resolvedStatusLine(resolved) {
  const service = resolvedService(resolved);
  const bits = [SERVICE_LABELS[service] || "Photo Session"];
  bits.push(resolved.date ? `date ${DATE_STATUS_LABELS[resolved.dateStatus]}` : "no session date yet");
  if (resolved.time && resolved.timeStatus === "proposed") bits.push("time requested, not yet confirmed");
  bits.push(resolved.totalCents == null ? "total needs review" : `${fmt(resolved.totalCents / 100)} total`);
  return bits.join(" · ");
}

// What to say about the date next to [SESSION_DATE] / [FINAL_DATE], or "" when it is settled.
function contractDateNote(inq) {
  const status = inq._dateStatus;
  if (!status || status === "confirmed") return "";
  if (status === "unknown") return "No session date is known yet. [SESSION_DATE] and [FINAL_DATE] stay TBD until you enter one.";
  return `Session date ${DATE_STATUS_LABELS[status]}. [FINAL_DATE] (balance due) uses the same date: check both before sending.`;
}
