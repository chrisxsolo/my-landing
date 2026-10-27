// Suggests which inquiry an unlinked ledger payment belongs to, and finds
// inquiries marked paid whose money never reached the ledger.
//
// Evidence order: an exact payer email is strong; a full-name match is a
// suggestion. Nothing is linked automatically — the admin confirms each link.

import type { AdminInquiry } from "@/lib/adminInquiries";
import { nameTokens } from "@/lib/paymentMatching";
import type { LedgerRow } from "./enrich";

export type LinkEvidence = "email" | "name";

export type LinkAction = {
  inquiryId: number;
  paymentIds: number[];
  evidence: LinkEvidence;
  label: string;
};

const MAX_NAME_SUGGESTIONS = 3;

const normEmail = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

function inquiryLabel(inquiry: AdminInquiry): string {
  const when = inquiry.session_date ? ` · ${inquiry.session_date}` : "";
  const type = inquiry.session_type ? ` · ${inquiry.session_type}` : "";
  return `#${inquiry.id} ${inquiry.name}${type}${when}`;
}

/** Every token of the shorter name appears in the longer one ("Milthon" ⊂ "Milthon Marquez"). */
export function namesAgree(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.size || !tb.size) return false;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return [...small].every(token => large.has(token));
}

/** Link suggestions for one payer's unlinked payments. */
export function suggestInquiryLinks(group: LedgerRow[], inquiries: AdminInquiry[]): LinkAction[] {
  const paymentIds = group.map(p => p.id);
  const email = normEmail(group.find(p => p.client_email)?.client_email);
  if (email) {
    const byEmail = inquiries.filter(i => normEmail(i.email) === email);
    if (byEmail.length) {
      return byEmail.map(i => ({ inquiryId: i.id, paymentIds, evidence: "email" as const, label: inquiryLabel(i) }));
    }
  }
  const name = group[0].client_name;
  return inquiries
    .filter(i => namesAgree(i.name, name))
    .slice(0, MAX_NAME_SUGGESTIONS)
    .map(i => ({ inquiryId: i.id, paymentIds, evidence: "name" as const, label: inquiryLabel(i) }));
}

export type PaidWithoutLedger = {
  inquiry: AdminInquiry;
  /** Active ledger rows that look like this client's, wherever they are linked. */
  candidates: LedgerRow[];
};

function rowBelongsTo(row: LedgerRow, inquiry: AdminInquiry): boolean {
  const email = normEmail(inquiry.email);
  if (email && normEmail(row.client_email) === email) return true;
  return namesAgree(row.client_name, inquiry.name) && nameTokens(inquiry.name).size >= 2;
}

/**
 * Inquiries whose payment_status says "paid" but that have no active ledger
 * payment linked. These are the sessions that silently drop out of revenue.
 */
export function findPaidInquiriesWithoutLedger(
  inquiries: AdminInquiry[],
  rows: LedgerRow[],
): PaidWithoutLedger[] {
  const active = rows.filter(r => r.status === "active");
  const linked = new Set(active.map(r => r.inquiry_id).filter((id): id is number => id != null));
  return inquiries
    .filter(i => i.payment_status === "paid" && !linked.has(i.id))
    .map(inquiry => ({ inquiry, candidates: active.filter(r => rowBelongsTo(r, inquiry)) }));
}
