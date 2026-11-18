import { describe, expect, it } from "vitest";
import {
  EMPTY_REVIEW_QUEUE,
  indexReviewQueue,
  resolveBookingPaymentState,
} from "@/lib/bookingPaymentState";

const queue = indexReviewQueue({
  staged: [
    { inquiry_id: 1 },
    { inquiry_id: 1 },
    { inquiry_id: null }, // orphan: stays in the review queue, never attached to a client
  ],
  unprojected: [{ inquiryId: 4 }],
});

describe("resolveBookingPaymentState", () => {
  it("shows a detected-but-unapproved payment as awaiting review, never as paid", () => {
    const state = resolveBookingPaymentState({ id: 1, payment_status: "unpaid", deposit_paid_at: null }, queue);
    expect(state).toMatchObject({ paid: false, label: "Unpaid", review: "awaiting", depositPaidAt: null });
  });

  it("does not attach another client's or an orphan pending row to this inquiry", () => {
    const state = resolveBookingPaymentState({ id: 2, payment_status: null, deposit_paid_at: null }, queue);
    expect(state).toMatchObject({ paid: false, label: "Unpaid", review: null });
  });

  it("labels a stamped deposit as Deposit paid even when payment_status is stale", () => {
    const state = resolveBookingPaymentState(
      { id: 3, payment_status: "unpaid", deposit_paid_at: "2026-11-09T18:00:00.000Z" }, queue);
    expect(state).toMatchObject({ paid: true, label: "Deposit paid", depositPaidAt: "2026-11-09T18:00:00.000Z" });
  });

  it("keeps the review hint when a paid booking still has a payment waiting for approval", () => {
    const state = resolveBookingPaymentState(
      { id: 1, payment_status: "unpaid", deposit_paid_at: "2026-11-09T18:00:00.000Z" }, queue);
    expect(state).toMatchObject({ paid: true, label: "Deposit paid", review: "awaiting" });
  });

  it("shows a legacy paid flag without inventing a deposit date", () => {
    const state = resolveBookingPaymentState({ id: 5, payment_status: "paid", deposit_paid_at: null }, queue);
    expect(state).toMatchObject({ paid: true, label: "Paid", depositPaidAt: null, review: null });
  });

  it("flags an approved payment whose booking was never updated", () => {
    const state = resolveBookingPaymentState({ id: 4, payment_status: "unpaid", deposit_paid_at: null }, queue);
    expect(state).toMatchObject({ paid: false, review: "needs_repair" });
  });

  it("reports nothing waiting when the queue is empty", () => {
    const state = resolveBookingPaymentState({ id: 1, payment_status: null, deposit_paid_at: null }, EMPTY_REVIEW_QUEUE);
    expect(state.review).toBeNull();
  });
});

describe("indexReviewQueue", () => {
  it("counts pending rows per inquiry and ignores rows without an inquiry link", () => {
    expect(queue.awaiting.get(1)).toBe(2);
    expect(queue.awaiting.size).toBe(1);
    expect(queue.needsRepair.has(4)).toBe(true);
  });
});
