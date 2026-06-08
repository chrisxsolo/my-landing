import { COUPLES_PACKAGES, GRAD_HOURLY_RATE, getGroupRatePerPerson } from "./pricing";
import {
  getGraduationTravelFeeFromText,
  inferTotalFromRetainer,
} from "./pricingCatalog";

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

export function inferSessionTotalCents(inquiry: PaymentTotalInquiry | null | undefined): number {
  if (!inquiry) return 0;

  const explicit = parseKnownMoneyCents(inquiry.payment_note) || parseKnownMoneyCents(inquiry.message);
  if (explicit > 0) return explicit;

  const text = [
    inquiry.session_type,
    inquiry.message,
    inquiry.school,
    inquiry.location,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\bgrad|graduat|campus|sjsu|berkeley|stanford|sf state|santa clara|csueb\b/.test(text)) {
    const people = parsePeopleCount(inquiry.people, text);
    const base = people > 1 ? getGroupRatePerPerson(people) * people : GRAD_HOURLY_RATE;
    return Math.round((base + getGraduationTravelFeeFromText(text)) * 100);
  }

  if (/\bproposal\b/.test(text)) return COUPLES_PACKAGES.proposal.price * 100;
  if (/\bengagement\b/.test(text)) return COUPLES_PACKAGES.engagement.price * 100;
  if (/\bsignature\b/.test(text)) return COUPLES_PACKAGES.signature.price * 100;
  if (/\bmini\b/.test(text)) return COUPLES_PACKAGES.mini.price * 100;
  if (/\bcouple|portrait|anniversary\b/.test(text)) return COUPLES_PACKAGES["1hr"].price * 100;

  return 0;
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
