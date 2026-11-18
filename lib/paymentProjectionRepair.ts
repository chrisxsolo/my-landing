// Server-only: finds and repairs confirmed ledger payments whose booking was
// never updated. Reads the ledger, never writes it — the payment itself is
// already recorded; only its inquiry / calendar / portal effects are redone.
import type { SupabaseClient } from "@supabase/supabase-js";
import { inquiryCountsAsPaid } from "@/lib/clientSessions";
import { CLOSED_INQUIRY_STATUSES } from "@/lib/paymentSyncShared";
import { projectConfirmedPayment, type ConfirmedPayment, type ProjectionStep } from "@/lib/paymentProjection";

const PAYMENTS_TABLE = "payments";
const INQUIRIES_TABLE = "inquiries";
const ACTIVE = "active";
const LEDGER_SCAN_LIMIT = 500;

export const PROJECTION_SELECT =
  "id,fingerprint,status,inquiry_id,client_name,client_email,amount,method,payment_type,paid_at,session_date";

export type LedgerProjectionRow = ConfirmedPayment & { id: number; fingerprint: string; status: string };

export type UnprojectedPayment = { paymentId: number; inquiryId: number; clientName: string; paidAt: string };

// A final installment never books a client, and a closed inquiry is not
// waiting to be booked — neither is a missing projection.
const FINAL_INSTALLMENT = "deposit_2";

type InquiryPaymentRow = { id: number; status: string | null; payment_status: string | null; deposit_paid_at: string | null };

/** Same rule as the Clients badge: an inquiry already shown as paid needs no repair. */
function awaitsProjection(inquiry: InquiryPaymentRow): boolean {
  return !inquiryCountsAsPaid(inquiry) && !CLOSED_INQUIRY_STATUSES.has(inquiry.status ?? "");
}

/** True when this inquiry is still shown unpaid, so a confirmed payment has not reached it. */
export async function inquiryAwaitsProjection(supabase: SupabaseClient, inquiryId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from(INQUIRIES_TABLE)
    .select("id,status,payment_status,deposit_paid_at")
    .eq("id", inquiryId)
    .maybeSingle<InquiryPaymentRow>();
  if (error) throw error;
  return !!data && awaitsProjection(data);
}

/**
 * Active, inquiry-linked first payments whose booking still reads unpaid —
 * an approval that only got partway. Newest first, so a just-approved payment
 * is never the row a cap cuts off.
 */
export async function loadUnprojectedPayments(supabase: SupabaseClient): Promise<UnprojectedPayment[]> {
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select("id,inquiry_id,client_name,paid_at,payment_type")
    .eq("status", ACTIVE)
    .not("inquiry_id", "is", null)
    .order("paid_at", { ascending: false })
    .limit(LEDGER_SCAN_LIMIT);
  if (error) throw error;
  type Row = { id: number; inquiry_id: number; client_name: string; paid_at: string; payment_type: string | null };
  const payments = ((data ?? []) as Row[]).filter(p => p.payment_type !== FINAL_INSTALLMENT);
  if (!payments.length) return [];

  const { data: inquiries, error: inquiryError } = await supabase
    .from(INQUIRIES_TABLE)
    .select("id,status,payment_status,deposit_paid_at")
    .or("payment_status.is.null,payment_status.neq.paid")
    .is("deposit_paid_at", null);
  if (inquiryError) throw inquiryError;
  const waiting = new Set(((inquiries ?? []) as InquiryPaymentRow[]).filter(awaitsProjection).map(i => i.id));

  return payments
    .filter(p => waiting.has(p.inquiry_id))
    .map(p => ({ paymentId: p.id, inquiryId: p.inquiry_id, clientName: p.client_name, paidAt: p.paid_at }));
}

export type RepairOutcome = {
  repaired: number;
  incomplete: { id: number; paymentId: number; failed: ProjectionStep[] }[];
  portalAmbiguous: number[];
};

/** Re-applies booking side effects for the given ledger payment ids, oldest first. */
export async function repairPayments(supabase: SupabaseClient, paymentIds: number[], now: string): Promise<RepairOutcome> {
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select(PROJECTION_SELECT)
    .eq("status", ACTIVE)
    .not("inquiry_id", "is", null)
    .in("id", paymentIds)
    .order("paid_at", { ascending: true });
  if (error) throw error;

  const outcome: RepairOutcome = { repaired: 0, incomplete: [], portalAmbiguous: [] };
  for (const payment of (data ?? []) as unknown as LedgerProjectionRow[]) {
    const result = await projectConfirmedPayment(supabase, payment, now);
    if (result.failed.length) outcome.incomplete.push({ id: payment.id, paymentId: payment.id, failed: result.failed });
    else outcome.repaired++;
    if (result.portalAmbiguous) outcome.portalAmbiguous.push(payment.id);
  }
  return outcome;
}
