// ─────────────────────────────────────────────────────────────────────────────
// Administrative status, from the record rather than from the prose.
//
// This is the fix for the worst class of failure the assistant had. A draft to
// a family client said "I sent the invoice and contract to your email to
// secure your session". No invoice had been sent. `inquiries.invoice_sent_at`
// was NULL the whole time.
//
// The reason is that generation never saw the database. Invoice, contract and
// deposit state were inferred ONLY by regex over the Gmail thread
// (lib/ai/threadDigest.ts), which is a reasonable fallback and a poor primary
// source — and which currently returns nothing at all, because the app's Gmail
// refresh token is revoked.
//
// So: the inquiries row is authoritative. A timestamp is a fact. The thread
// may only ADD the softer reading — that Chris promised something he has not
// done — and may never contradict a timestamp.
//
// These are separate events and the draft must not blur them:
//   invoice sent  ≠  invoice paid
//   contract sent ≠  contract signed
//   deposit paid  ≠  session confirmed
// ─────────────────────────────────────────────────────────────────────────────

import type { ThreadDigest } from "./threadDigest";

/** The columns this module reads. Narrowed so callers cannot pass junk. */
export type InquiryAdminRow = {
  invoice_sent_at?: string | null;
  contract_sent_at?: string | null;
  deposit_paid_at?: string | null;
  gallery_delivered_at?: string | null;
  confirmation_sent_at?: string | null;
  booking_confirmed?: boolean | null;
  payment_status?: string | null;
  session_date?: string | null;
};

export type AdminStatus = {
  invoiceSent: boolean;
  contractSent: boolean;
  depositPaid: boolean;
  galleryDelivered: boolean;
  confirmationSent: boolean;
  bookingConfirmed: boolean;
  sessionDate: string | null;
  /** True when Chris said he would send something but no record shows he did. */
  invoicePromised: boolean;
  contractPromised: boolean;
  /**
   * False when no inquiry record was supplied, so every flag above is a
   * fallback read off the thread rather than a verified fact.
   */
  verified: boolean;
};

const stamped = (value: string | null | undefined): boolean => Boolean(value && String(value).trim());

/**
 * Merges the record with the thread.
 *
 * The record wins on every event. The thread contributes only "promised",
 * and only where the record shows the thing has not happened.
 */
export function buildAdminStatus(
  row: InquiryAdminRow | null | undefined,
  digest: ThreadDigest,
): AdminStatus {
  if (!row) {
    // No record. Fall back to the thread and say so, so the prompt can be
    // appropriately cautious rather than confidently wrong.
    return {
      invoiceSent: digest.invoice === "sent",
      contractSent: digest.contract === "sent",
      depositPaid: digest.depositPaid,
      galleryDelivered: false,
      confirmationSent: false,
      bookingConfirmed: false,
      sessionDate: null,
      invoicePromised: digest.invoice === "promised",
      contractPromised: digest.contract === "promised",
      verified: false,
    };
  }

  const invoiceSent = stamped(row.invoice_sent_at);
  const contractSent = stamped(row.contract_sent_at);
  const depositPaid = stamped(row.deposit_paid_at) || row.payment_status === "paid";

  return {
    invoiceSent,
    contractSent,
    depositPaid,
    galleryDelivered: stamped(row.gallery_delivered_at),
    confirmationSent: stamped(row.confirmation_sent_at),
    bookingConfirmed: Boolean(row.booking_confirmed) || depositPaid,
    sessionDate: row.session_date?.trim() || null,
    // Only meaningful while the record says it has not happened.
    invoicePromised: !invoiceSent && digest.invoice !== "none",
    contractPromised: !contractSent && digest.contract !== "none",
    verified: true,
  };
}

/**
 * The prompt lines.
 *
 * Phrased as what the draft MAY and MAY NOT claim, because that is the thing
 * that went wrong. A flat status list reads as background; "do not say you
 * sent it" is an instruction.
 */
export function renderAdminStatus(status: AdminStatus): string[] {
  const lines: string[] = [];

  if (!status.verified) {
    lines.push(
      "No booking record was loaded for this client, so nothing below is verified. Do not claim that any invoice, contract, payment, or gallery has been sent, received, or delivered.",
    );
  }

  // Collapsed when nothing has happened, which is most inquiries. Three
  // separate negative sentences cost tokens on every draft to say one thing.
  const nothingYet = !status.invoiceSent && !status.contractSent && !status.depositPaid;
  if (nothingYet) {
    lines.push(
      "No invoice has been sent, no contract has been sent, and no deposit has been received. You may say you'll send the paperwork once the details are settled. Do NOT say any of it has been sent, is on its way, or is in their inbox, and do not call the session confirmed, booked, secured, or all set.",
    );
  } else {
    lines.push(
      status.invoiceSent
        ? "The invoice HAS been sent. Do not say you will send it later."
        : "No invoice has been sent. Do not say it has been.",
    );
    lines.push(
      status.contractSent
        ? "The contract HAS been sent. Do not say you will send it later."
        : "No contract has been sent. Do not say it has been.",
    );
    lines.push(
      status.depositPaid
        ? "The deposit HAS been received, so the session is paid for."
        : "No deposit has been received. Do not call the session confirmed, booked, secured, or all set.",
    );
    lines.push("Sent, paid, signed and confirmed are four different things. Never use one to imply another.");
  }

  if (status.galleryDelivered) lines.push("The gallery HAS been delivered.");
  if (status.sessionDate) {
    // Worded so a paraphrase cannot leak the mechanism: a draft once wrote
    // "your session date on record is May 20th", which is internal language.
    lines.push(`Their session is ${status.sessionDate}. That is settled, so name it as a plain fact ("your session on May 20th") and never as a record, a file, or something you looked up. Do not offer alternatives unless they asked to move it.`);
  }
  if (status.invoicePromised || status.contractPromised) {
    lines.push("Chris has already told them the paperwork is coming. Do not explain the invoice and contract step again from scratch.");
  }
  return lines;
}
