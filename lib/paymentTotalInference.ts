import { COUPLES_PACKAGES, GRAD_HOURLY_RATE, getGroupRatePerPerson } from "./pricing";
import { PRICING_CATALOG, inferTotalFromRetainer } from "./pricingCatalog";
import { classifySession, type PlaybookKey } from "./ai/sessionClassifier";
import { detectSchoolsInText } from "./schoolDetection";
import { resolveTravel, travelFeeAmount } from "./travelResolution";

export const PAYMENT_SOURCE_MANUAL = "auto";

export type PaymentTotalInquiry = {
  session_type?: string | null;
  message?: string | null;
  payment_note?: string | null;
  school?: string | null;
  location?: string | null;
  people?: string | number | null;
};

export type PaymentTotalRow = {
  payment_type?: string | null;
  amount?: string | null;
  amount_cents?: number | null;
  status?: string | null;
};

export function parseLoosePaymentCents(value: string | null | undefined): number {
  const match = value?.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0].replace(/,/g, "")) * 100);
}

export function parseKnownMoneyCents(value: string | null | undefined): number {
  if (!value) return 0;

  const dollar = value.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (dollar) return parseLoosePaymentCents(dollar[1]);

  const dollarsWord = value.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:dollars|usd)\b/i);
  if (dollarsWord) return parseLoosePaymentCents(dollarsWord[1]);

  const contextual = value.match(/\b(?:total|quote|quoted|price|fee|package|invoice|retainer|balance)\b[^\d$]{0,32}([\d,]+(?:\.\d{1,2})?)/i);
  if (!contextual) return 0;

  const cents = parseLoosePaymentCents(contextual[1]);
  return cents >= 10000 ? cents : 0;
}

function parsePeopleCount(value: string | number | null | undefined, text: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const fromField = String(value ?? "").match(/\d+/);
  if (fromField) return Math.max(1, Number(fromField[0]));

  const explicit = text.match(/\b(\d+)\s*(?:people|persons|graduates|grads|clients)\b/i);
  return explicit ? Math.max(1, Number(explicit[1])) : 1;
}

/** A campus named with no service at all: the legacy reading, kept as a last resort. */
const CAMPUS_HINT = /\bcampus\b|sjsu|berkeley|stanford|sf state|santa clara|csueb/;

/**
 * The service first, then its rate. A university in the text says where
 * someone studied, not what they booked: an elopement by two SJSU alumni is
 * an elopement.
 */
function serviceOf(inquiry: PaymentTotalInquiry, text: string): PlaybookKey | null {
  const key = classifySession(inquiry.session_type, inquiry.message).key;
  if (key) return key;
  if (inquiry.school || CAMPUS_HINT.test(text)) return "graduation";
  return null;
}

/** Graduation rate plus travel to where the shoot is (the campus, unless a location says otherwise). */
function graduationTotalCents(inquiry: PaymentTotalInquiry, text: string): number {
  const people = parsePeopleCount(inquiry.people, text);
  const base = people > 1 ? getGroupRatePerPerson(people) * people : GRAD_HOURLY_RATE;
  const school = inquiry.school || detectSchoolsInText(text)[0]?.canonicalName || null;
  const travel = resolveTravel({ school, location: inquiry.location, message: inquiry.message });
  return Math.round((base + travelFeeAmount(travel)) * 100);
}

// Fixed-price services the rate card totals on its own. Family has two
// packages, so it is resolved from the text below.
const FIXED_RATES: Partial<Record<PlaybookKey, number>> = {
  proposal: COUPLES_PACKAGES.proposal.price,
  engagement: COUPLES_PACKAGES.engagement.price,
  maternity: PRICING_CATALOG.maternity.price,
};

/** Family packages: the extended package when the text asks for it, else standard. */
function familyRate(text: string): number {
  const { standard, extended } = PRICING_CATALOG.families.packages;
  return /\bextended\b/.test(text) ? extended.price : standard.price;
}

/** Session price from the published rate card alone — session type, group
 *  size, and travel to the shoot location. Ignores any dollar figure written
 *  on the inquiry, so callers that must not mistake a deposit for the total
 *  (the booking confirmation email) can price the shoot from the catalog. */
export function catalogSessionTotalCents(inquiry: PaymentTotalInquiry | null | undefined): number {
  if (!inquiry) return 0;

  const text = [
    inquiry.session_type,
    inquiry.message,
    inquiry.school,
    inquiry.location,
  ].filter(Boolean).join(" ").toLowerCase();

  const service = serviceOf(inquiry, text);
  if (service === "graduation") return graduationTotalCents(inquiry, text);

  // An elopement starts at $950, but its coverage duration is settled per
  // booking, so the rate card cannot total one. Returning 0 sends the caller to
  // the price quoted in the thread.
  if (service === "elopement") return 0;

  if (service === "family") return familyRate(text) * 100;

  const fixed = service ? FIXED_RATES[service] : undefined;
  if (fixed) return fixed * 100;
  if (/\bsignature\b/.test(text)) return COUPLES_PACKAGES.signature.price * 100;
  if (/\bmini\b/.test(text)) return COUPLES_PACKAGES.mini.price * 100;
  if (service === "couples" || /\bcouple|portrait|anniversary\b/.test(text)) return COUPLES_PACKAGES["1hr"].price * 100;

  return 0;
}

export function inferSessionTotalCents(inquiry: PaymentTotalInquiry | null | undefined): number {
  if (!inquiry) return 0;

  const explicit = parseKnownMoneyCents(inquiry.payment_note) || parseKnownMoneyCents(inquiry.message);
  if (explicit > 0) return explicit;

  return catalogSessionTotalCents(inquiry);
}

export function inferPaymentTotalCents(
  payments: PaymentTotalRow[],
  inquiry: PaymentTotalInquiry | null | undefined,
): number {
  const active = payments.filter(payment => (
    payment.status !== "voided"
    && (payment.amount_cents ?? parseLoosePaymentCents(payment.amount)) > 0
  ));
  const full = active.find(payment => payment.payment_type === "full");
  if (full) return full.amount_cents ?? parseLoosePaymentCents(full.amount);

  const deposits = active.filter(payment => payment.payment_type === "deposit_1" || payment.payment_type === "deposit_2");
  if (deposits.length >= 2) {
    return deposits.reduce((sum, payment) => sum + (payment.amount_cents ?? parseLoosePaymentCents(payment.amount)), 0);
  }
  if (deposits.length === 1) {
    return inferTotalFromRetainer(
      deposits[0].amount_cents ?? parseLoosePaymentCents(deposits[0].amount),
    );
  }

  return inferSessionTotalCents(inquiry);
}
