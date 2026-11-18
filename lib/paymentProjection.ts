// Server-only: applies a CONFIRMED ledger payment to the booking it belongs to
// — the inquiry's paid/deposit fields, the availability calendar and the
// client's portal session. Every write is checked and every step is safe to
// repeat, so an approval that only got partway can be finished later without
// touching the ledger again.
import type { SupabaseClient } from "@supabase/supabase-js";
import { advancePortalSessionForDeposit } from "@/lib/adminPortalSessionUpsert";
import { buildBookedAvailabilityNote } from "@/lib/clientSessions";

const INQUIRIES_TABLE = "inquiries";
const AVAILABILITY_TABLE = "availability";

export type ProjectionStep = "inquiry" | "availability" | "portal";

export type ConfirmedPayment = {
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount: string;
  method: string;
  payment_type: string | null;
  paid_at: string;
  session_date: string | null;
};

export type ProjectionResult = {
  failed: ProjectionStep[];
  /** The client has several portal sessions and none matched; nothing was changed. */
  portalAmbiguous: boolean;
};

type InquiryBooking = {
  name: string | null;
  email: string | null;
  session_type: string | null;
  session_date: string | null;
  preferred_time: string | null;
  deposit_paid_at: string | null;
  payment_detected_at: string | null;
};

async function projectInquiry(
  supabase: SupabaseClient, payment: ConfirmedPayment, now: string,
): Promise<{ inquiry: InquiryBooking | null; ok: boolean }> {
  if (!payment.inquiry_id) return { inquiry: null, ok: true };

  const { data, error } = await supabase
    .from(INQUIRIES_TABLE)
    .select("name, email, session_type, session_date, preferred_time, deposit_paid_at, payment_detected_at")
    .eq("id", payment.inquiry_id)
    .maybeSingle<InquiryBooking>();
  if (error) {
    console.error(`[payment-projection] inquiry ${payment.inquiry_id} read failed:`, error);
    return { inquiry: null, ok: false };
  }
  // The inquiry was deleted: nothing to mark paid, so treat the payment as unlinked.
  if (!data) return { inquiry: null, ok: true };

  // The deposit date is when the money first arrived, never when it was
  // reviewed. A later payment of any type must not move an earlier date.
  const keepDepositDate = !!data.deposit_paid_at
    && new Date(data.deposit_paid_at).getTime() <= new Date(payment.paid_at).getTime();
  const { error: updateError } = await supabase.from(INQUIRIES_TABLE).update({
    payment_status: "paid",
    payment_note: `${payment.method || "Payment"}: ${payment.amount}`,
    payment_detected_at: data.payment_detected_at ?? now,
    deposit_paid_at: keepDepositDate ? data.deposit_paid_at : payment.paid_at,
    booking_confirmed: true,
  }).eq("id", payment.inquiry_id);
  if (updateError) {
    console.error(`[payment-projection] inquiry ${payment.inquiry_id} update failed:`, updateError);
    return { inquiry: data, ok: false };
  }
  return { inquiry: data, ok: true };
}

export async function projectConfirmedPayment(
  supabase: SupabaseClient, payment: ConfirmedPayment, now: string,
): Promise<ProjectionResult> {
  const failed: ProjectionStep[] = [];
  const { inquiry, ok } = await projectInquiry(supabase, payment, now);
  if (!ok) failed.push("inquiry");
  // Without the inquiry there is no session type, date or client identity to
  // book against; the repair pass redoes every step once it can be read.
  if (!ok && !inquiry) return { failed, portalAmbiguous: false };

  // The payer can be someone else (a parent, a partner): the booking belongs
  // to the inquiry's client, not to whoever sent the money.
  const clientName = inquiry?.name?.trim() || payment.client_name;
  const clientEmail = inquiry?.email?.trim() || payment.client_email;
  // The inquiry's date wins: the payment's copy is from when it was detected
  // and goes stale if the session is rescheduled before a repair runs.
  const sessionDate = inquiry?.session_date ?? payment.session_date ?? null;
  if (sessionDate) {
    const { error } = await supabase.from(AVAILABILITY_TABLE).upsert(
      { date: sessionDate, status: "booked", note: buildBookedAvailabilityNote(clientName, inquiry?.preferred_time) },
      { onConflict: "date" },
    );
    if (error) {
      console.error(`[payment-projection] availability update failed for inquiry ${payment.inquiry_id}:`, error);
      failed.push("availability");
    }
  }

  // A paid deposit means the client is booked — make sure the portal reflects
  // it even when the whole booking happened over email.
  let portalAmbiguous = false;
  try {
    const result = await advancePortalSessionForDeposit(supabase, {
      clientEmail,
      clientName,
      sessionType: inquiry?.session_type ?? null,
      sessionDate,
    });
    portalAmbiguous = result === "ambiguous";
  } catch (error) {
    console.error(`[payment-projection] portal session update failed for inquiry ${payment.inquiry_id}:`, error);
    failed.push("portal");
  }

  return { failed, portalAmbiguous };
}
