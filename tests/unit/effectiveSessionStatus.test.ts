import { describe, expect, it } from "vitest";
import { inquiryCountsAsPaid, resolveEffectiveSessionStatus } from "@/lib/clientSessions";

describe("inquiryCountsAsPaid", () => {
  it("counts an approved ledger payment", () => {
    expect(inquiryCountsAsPaid({ payment_status: "paid", deposit_paid_at: null })).toBe(true);
  });

  it("counts a timeline-stamped deposit before ledger approval", () => {
    expect(inquiryCountsAsPaid({ payment_status: "unpaid", deposit_paid_at: "2026-08-17T18:02:11Z" })).toBe(true);
  });

  it("stays false with no payment evidence", () => {
    expect(inquiryCountsAsPaid({ payment_status: "unpaid", deposit_paid_at: null })).toBe(false);
    expect(inquiryCountsAsPaid({})).toBe(false);
  });
});

describe("resolveEffectiveSessionStatus", () => {
  it("keeps a booked session booked when the deposit is stamped but unapproved", () => {
    const inquiry = { payment_status: "unpaid", deposit_paid_at: "2026-08-17T18:02:11Z" };
    expect(resolveEffectiveSessionStatus("booked", inquiryCountsAsPaid(inquiry))).toBe("booked");
  });

  it("still demotes a booked session with no payment evidence", () => {
    expect(resolveEffectiveSessionStatus("booked", inquiryCountsAsPaid({}))).toBe("booking_in_progress");
  });

  it("never regresses a stage past booked", () => {
    expect(resolveEffectiveSessionStatus("editing", false)).toBe("editing");
  });
});
