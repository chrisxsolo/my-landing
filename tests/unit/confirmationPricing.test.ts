import { describe, expect, it } from "vitest";
import { formatCents, parseMoneyCents, resolveConfirmationPricing } from "@/lib/confirmationPricing";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";

const COUPLES = { session_type: "Couples Session", message: null, school: null, location: null };
const GRAD_SJSU = { session_type: "Graduation", message: null, school: "San Jose State University", location: null };

describe("parseMoneyCents / formatCents", () => {
  it("parses the shapes clients and the AI write", () => {
    expect(parseMoneyCents("225")).toBe(22500);
    expect(parseMoneyCents("$1,500.50")).toBe(150050);
    expect(parseMoneyCents(450)).toBe(45000);
    expect(parseMoneyCents("no amount")).toBe(0);
    expect(parseMoneyCents(null)).toBe(0);
  });

  it("drops trailing zero cents", () => {
    expect(formatCents(45000)).toBe("$450");
    expect(formatCents(45050)).toBe("$450.50");
    expect(formatCents(0)).toBe("");
  });
});

describe("resolveConfirmationPricing", () => {
  it("prices a couples session off the rate card and splits by the retainer policy", () => {
    const p = resolveConfirmationPricing({ inquiry: COUPLES });
    const total = PRICING_CATALOG.couples.packages["1hr"].price;
    const retainer = total * (BOOKING_POLICY.retainerPercent / 100);

    expect(p.sessionTotal).toBe(`$${total}`);
    expect(p.amount).toBe(`$${retainer}`);
    expect(p.amountSource).toBe("retainer");
    expect(p.balanceDue).toBe(`$${total - retainer}`);
    expect(p.balanceNote).toContain(BOOKING_POLICY.remainingBalanceDeadline);
  });

  it("adds the campus travel fee for a graduation shoot", () => {
    const p = resolveConfirmationPricing({ inquiry: GRAD_SJSU });
    const total = PRICING_CATALOG.graduation.baseHourlyRate + PRICING_CATALOG.graduation.travelFees.sjsu;
    expect(p.sessionTotal).toBe(`$${total}`);
  });

  it("prefers a recorded payment over the estimated retainer", () => {
    const p = resolveConfirmationPricing({ inquiry: COUPLES, recordedAmount: "$200" });
    expect(p.amount).toBe("$200");
    expect(p.amountSource).toBe("recorded");
    expect(p.balanceDue).toBe("$250");
  });

  it("prefers a price quoted in the thread over the rate card", () => {
    const p = resolveConfirmationPricing({ inquiry: COUPLES, threadAmount: "300", threadTotal: "600" });
    expect(p.sessionTotal).toBe("$600");
    expect(p.amount).toBe("$300");
    expect(p.amountSource).toBe("thread");
    expect(p.balanceDue).toBe("$300");
  });

  it("marks a fully paid session instead of showing a balance", () => {
    const p = resolveConfirmationPricing({ inquiry: COUPLES, recordedAmount: "$450" });
    expect(p.balanceDue).toBe("");
    expect(p.balanceNote).toBe("Paid in full ✓");
  });

  it("drops the breakdown when the payment exceeds the estimated total", () => {
    const p = resolveConfirmationPricing({ inquiry: COUPLES, recordedAmount: "$900" });
    expect(p.amount).toBe("$900");
    expect(p.sessionTotal).toBe("");
    expect(p.balanceDue).toBe("");
  });

  it("returns nothing to show when the shoot cannot be priced", () => {
    const p = resolveConfirmationPricing({ inquiry: { session_type: "Something else" } });
    expect(p).toEqual({ amount: "", amountSource: "none", sessionTotal: "", balanceDue: "", balanceNote: "" });
  });

  it("still shows a recorded payment when the shoot cannot be priced", () => {
    const p = resolveConfirmationPricing({ inquiry: null, recordedAmount: "$175" });
    expect(p.amount).toBe("$175");
    expect(p.sessionTotal).toBe("");
  });
});
