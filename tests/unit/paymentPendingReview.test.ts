import { describe, it, expect } from "vitest";
import {
  describePaymentSyncOutcome,
  formatReviewDollars,
  summarizePendingReview,
} from "@/lib/paymentSyncShared";

describe("summarizePendingReview", () => {
  it("counts rows and sums cents, treating null amounts as zero", () => {
    expect(summarizePendingReview([{ amount_cents: 55000 }, { amount_cents: 42500 }, { amount_cents: null }]))
      .toEqual({ count: 3, cents: 97500 });
  });

  it("returns zeros for an empty queue", () => {
    expect(summarizePendingReview([])).toEqual({ count: 0, cents: 0 });
  });
});

describe("formatReviewDollars", () => {
  it("drops cents for whole dollars and keeps them otherwise", () => {
    expect(formatReviewDollars(97500)).toBe("$975");
    expect(formatReviewDollars(587250)).toBe("$5,872.50");
  });
});

describe("describePaymentSyncOutcome", () => {
  it("surfaces the existing backlog even when this run found nothing new", () => {
    const msg = describePaymentSyncOutcome({ total: 0, pendingReview: { count: 2, cents: 97500 } });
    expect(msg).toContain("0 new payments found.");
    expect(msg).toContain("2 payments ($975) awaiting your approval");
    expect(msg).toContain("not counted in revenue");
  });

  it("says nothing is waiting when the queue is empty", () => {
    expect(describePaymentSyncOutcome({ total: 1, pendingReview: { count: 0, cents: 0 } }))
      .toBe("1 new payment found. Nothing awaiting approval.");
  });

  it("appends search warnings", () => {
    const msg = describePaymentSyncOutcome({ total: 0, pendingReview: null, warnings: ["2 of 5 searches failed."] });
    expect(msg).toContain("⚠ 2 of 5 searches failed.");
  });
});
