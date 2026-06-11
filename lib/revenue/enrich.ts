// Joins ledger payments with their inquiries and normalizes the analytical
// dimensions (service, school) every dashboard section groups by.

import type { AdminInquiry } from "@/lib/adminInquiries";
import type { PaymentRow } from "@/lib/paymentFilters";
import { detectSchoolKey, SCHOOL_UNLINKED } from "./schools";

export type ServiceKey = "graduation" | "couples" | "family" | "portrait" | "event" | "other" | "unlinked";

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  graduation: "Graduation",
  couples: "Couples",
  family: "Family",
  portrait: "Portraits",
  event: "Events",
  other: "Other",
  unlinked: "No linked inquiry",
};

export type LedgerRow = PaymentRow & {
  serviceKey: ServiceKey;
  schoolKey: string;
  inquiry: AdminInquiry | null;
};

export function normalizeService(sessionType: string | null | undefined, linked: boolean): ServiceKey {
  if (!sessionType) return linked ? "other" : "unlinked";
  const t = sessionType.toLowerCase();
  if (/grad/.test(t)) return "graduation";
  if (/couple|engagement|proposal|anniversary/.test(t)) return "couples";
  if (/family|maternity|newborn/.test(t)) return "family";
  if (/portrait|headshot|senior/.test(t)) return "portrait";
  if (/event|party|corporate/.test(t)) return "event";
  return "other";
}

export function enrichPayments(payments: PaymentRow[], inquiries: AdminInquiry[]): LedgerRow[] {
  const byId = new Map(inquiries.map(i => [i.id, i]));
  return payments.map(p => {
    const inquiry = p.inquiry_id != null ? byId.get(p.inquiry_id) ?? null : null;
    return {
      ...p,
      inquiry,
      serviceKey: normalizeService(p.inquiry_session_type ?? inquiry?.session_type, inquiry != null),
      schoolKey: inquiry ? detectSchoolKey(inquiry) : SCHOOL_UNLINKED.key,
    };
  });
}
