// Accounts receivable: estimated outstanding balances per booking.
//
// outstanding = inferred session total − collected-to-date, where the total
// comes from lib/paymentTotalInference (explicit quote in notes/messages,
// else deposit-pair sum, else retainer-based estimate, else pricing catalog).
// Totals inferred from a single retainer are estimates and labeled as such.
// A balance is "due" at the session date; aging buckets count days past it.

import type { AdminInquiry } from "@/lib/adminInquiries";
import { inferPaymentTotalCents } from "@/lib/paymentTotalInference";
import { clientKeyOf, confirmedRows, rowCents } from "./calc";
import type { LedgerRow } from "./enrich";

export type AgingBucket = "notDue" | "due1to7" | "due8to30" | "due30plus" | "unknown";

export const AGING_META: Record<AgingBucket, { label: string; order: number }> = {
  due30plus: { label: "30+ days overdue", order: 0 },
  due8to30: { label: "8–30 days overdue", order: 1 },
  due1to7: { label: "1–7 days overdue", order: 2 },
  notDue: { label: "Not yet due", order: 3 },
  unknown: { label: "No session date", order: 4 },
};

export type Receivable = {
  inquiryId: number;
  clientName: string;
  clientEmail: string;
  serviceType: string | null;
  totalCents: number;
  totalIsEstimate: boolean;
  paidCents: number;
  outstandingCents: number;
  sessionDate: string | null;
  daysOutstanding: number | null; // days past session date; negative = upcoming
  bucket: AgingBucket;
  paymentIds: number[];
};

function agingBucket(daysPast: number | null): AgingBucket {
  if (daysPast === null) return "unknown";
  if (daysPast <= 0) return "notDue";
  if (daysPast <= 7) return "due1to7";
  if (daysPast <= 30) return "due8to30";
  return "due30plus";
}

/**
 * Build receivables from inquiries that have at least one confirmed payment
 * but whose inferred session total exceeds what was collected. Inquiries whose
 * payments include a `full` payment or a complete deposit pair resolve to
 * zero outstanding by construction (see inferPaymentTotalCents).
 */
export function buildReceivables(
  rows: LedgerRow[],
  inquiries: AdminInquiry[],
  now = new Date(),
): Receivable[] {
  const byInquiry = new Map<number, LedgerRow[]>();
  for (const p of confirmedRows(rows)) {
    if (p.inquiry_id == null) continue;
    const list = byInquiry.get(p.inquiry_id);
    if (list) list.push(p);
    else byInquiry.set(p.inquiry_id, [p]);
  }
  const inquiryById = new Map(inquiries.map(i => [i.id, i]));

  const out: Receivable[] = [];
  for (const [inquiryId, payments] of byInquiry) {
    const inquiry = inquiryById.get(inquiryId) ?? null;
    const paidCents = payments.reduce((s, p) => s + rowCents(p), 0);
    const totalCents = inferPaymentTotalCents(payments, inquiry);
    const outstandingCents = Math.max(0, totalCents - paidCents);
    if (outstandingCents <= 0) continue;

    // Totals are exact only when stated by the deposit structure itself.
    const hasFull = payments.some(p => p.payment_type === "full");
    const depositCount = payments.filter(
      p => p.payment_type === "deposit_1" || p.payment_type === "deposit_2",
    ).length;
    const totalIsEstimate = !hasFull && depositCount < 2;

    const sessionDate = inquiry?.session_date
      ?? payments.find(p => p.session_date)?.session_date
      ?? null;
    let daysOutstanding: number | null = null;
    if (sessionDate) {
      const due = new Date(`${sessionDate}T12:00:00`);
      if (!Number.isNaN(due.getTime())) {
        daysOutstanding = Math.floor((now.getTime() - due.getTime()) / 86400000);
      }
    }

    out.push({
      inquiryId,
      clientName: inquiry?.name ?? payments[0].client_name,
      clientEmail: inquiry?.email ?? payments[0].client_email,
      serviceType: inquiry?.session_type ?? payments[0].inquiry_session_type ?? null,
      totalCents,
      totalIsEstimate,
      paidCents,
      outstandingCents,
      sessionDate,
      daysOutstanding,
      bucket: agingBucket(daysOutstanding),
      paymentIds: payments.map(p => p.id),
    });
  }

  return out.sort(
    (a, b) => AGING_META[a.bucket].order - AGING_META[b.bucket].order
      || b.outstandingCents - a.outstandingCents,
  );
}

export function totalOutstandingCents(receivables: Receivable[]): number {
  return receivables.reduce((s, r) => s + r.outstandingCents, 0);
}

/** Receivables owed by a specific client (for the client drawer). */
export function receivablesForClient(receivables: Receivable[], clientKey: string): Receivable[] {
  return receivables.filter(
    r => clientKeyOf({ client_email: r.clientEmail, client_name: r.clientName }) === clientKey,
  );
}
