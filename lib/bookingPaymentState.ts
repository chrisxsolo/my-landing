// What the admin shows for one booking's payment. One resolver for the Clients
// badge, filters and the Deposit paid milestone, so they cannot disagree.
//
// "Paid" here is a booking fact (inquiryCountsAsPaid), not a ledger fact: a
// payment the sync detected but nobody approved is "awaiting review" and never
// counts as paid or as revenue.
import { inquiryCountsAsPaid } from "@/lib/clientSessions";

export type ReviewQueueIndex = {
  /** Pending staged payments per linked inquiry. Rows without a link are left out. */
  awaiting: ReadonlyMap<number, number>;
  /** Inquiries with a confirmed ledger payment that never reached the booking. */
  needsRepair: ReadonlySet<number>;
};

export const EMPTY_REVIEW_QUEUE: ReviewQueueIndex = { awaiting: new Map(), needsRepair: new Set() };

export function indexReviewQueue(input: {
  staged: readonly { inquiry_id: number | null }[];
  unprojected?: readonly { inquiryId: number }[];
}): ReviewQueueIndex {
  const awaiting = new Map<number, number>();
  for (const row of input.staged) {
    if (row.inquiry_id === null) continue;
    awaiting.set(row.inquiry_id, (awaiting.get(row.inquiry_id) ?? 0) + 1);
  }
  return { awaiting, needsRepair: new Set((input.unprojected ?? []).map(p => p.inquiryId)) };
}

export type BookingPaymentReview = "awaiting" | "needs_repair" | null;

export type BookingPaymentState = {
  paid: boolean;
  /** "Deposit paid" needs a recorded date; a legacy paid flag without one reads "Paid". */
  label: "Deposit paid" | "Paid" | "Unpaid";
  depositPaidAt: string | null;
  review: BookingPaymentReview;
};

export const BOOKING_PAYMENT_REVIEW_LABELS: Record<Exclude<BookingPaymentReview, null>, string> = {
  awaiting: "Payment awaiting review",
  needs_repair: "Payment approved — booking not updated",
};

export function resolveBookingPaymentState(
  inquiry: { id: number; payment_status?: string | null; deposit_paid_at?: string | null },
  queue: ReviewQueueIndex,
): BookingPaymentState {
  const depositPaidAt = inquiry.deposit_paid_at ?? null;
  const paid = inquiryCountsAsPaid(inquiry);
  const review: BookingPaymentReview = queue.awaiting.has(inquiry.id)
    ? "awaiting"
    : !paid && queue.needsRepair.has(inquiry.id) ? "needs_repair" : null;
  return {
    paid,
    label: depositPaidAt ? "Deposit paid" : paid ? "Paid" : "Unpaid",
    depositPaidAt,
    review,
  };
}
