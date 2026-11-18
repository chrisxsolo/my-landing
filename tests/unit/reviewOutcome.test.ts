import { describe, expect, it } from "vitest";
import { bookingRepairIds, describeReviewOutcome } from "@/app/admin/payments/reviewOutcome";

describe("describeReviewOutcome", () => {
  it("says nothing when every step landed", () => {
    expect(describeReviewOutcome({ ok: true, held: [], incomplete: [], failed: [], portalAmbiguous: [] })).toBe("");
  });

  it("does not report a half-applied approval as success", () => {
    const msg = describeReviewOutcome({ ok: true, incomplete: [{ id: 1, paymentId: 7, failed: ["inquiry", "portal"] }] });
    expect(msg).toContain("saved to the ledger");
    expect(msg).toContain("booking status, client portal update failed");
    expect(msg).toContain("Nothing was counted twice");
  });

  it("tells a queue-marker failure apart from a booking failure and only offers repair for the latter", () => {
    const json = { ok: true, incomplete: [
      { id: 1, paymentId: 7, failed: ["staging"] },
      { id: 2, paymentId: 8, failed: ["availability"] },
    ] };
    const msg = describeReviewOutcome(json);
    expect(msg).toContain("still listed here. Approve again");
    expect(msg).toContain("calendar update failed");
    expect(bookingRepairIds(json)).toEqual([8]);
  });

  it("separates rows that were never saved from rows held as possible duplicates", () => {
    const msg = describeReviewOutcome({ ok: true, failed: [3], held: [{ id: 4, matches: [9] }] });
    expect(msg).toContain("1 payment could not be saved and is still waiting");
    expect(msg).toContain("already in the ledger as #9");
  });

  it("explains an ambiguous portal match", () => {
    expect(describeReviewOutcome({ ok: true, portalAmbiguous: [2] })).toContain("several portal sessions");
  });
});
