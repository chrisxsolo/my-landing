// Business rules behind the public estimators: retainer math in cents, group
// duration minimums, and the per-service prices the site quotes.
import { describe, expect, it } from "vitest";
import {
  PRICING_CATALOG,
  calculatePaymentSchedule,
  calculatePaymentScheduleCents,
  getMinimumImageCountForSessionType,
} from "@/lib/pricingCatalog";
import {
  calculateCouplesEstimate,
  calculateGraduationEstimate,
  enforceSessionLength,
  isSessionLengthAllowed,
  type EstimateInput,
} from "@/lib/pricing";

const BASE: EstimateInput = {
  school: "usf",
  people: 1,
  sessionLength: "1hr",
  extraOutfit: false,
  secondLocation: false,
  expedited: false,
  champagne: false,
};

describe("retainer schedule", () => {
  it("splits whole-dollar totals evenly", () => {
    expect(calculatePaymentSchedule(350)).toEqual({ retainer: 175, remainingBalance: 175 });
  });

  it("keeps cents on an odd-dollar total instead of rounding to dollars", () => {
    expect(calculatePaymentSchedule(351)).toEqual({ retainer: 175.5, remainingBalance: 175.5 });
  });

  it("keeps cents on totals ending in 50 cents", () => {
    expect(calculatePaymentSchedule(393.5)).toEqual({ retainer: 196.75, remainingBalance: 196.75 });
  });

  it("gives an odd cent to the retainer and still sums exactly to the total", () => {
    expect(calculatePaymentScheduleCents(10001)).toEqual({ retainer: 5001, remainingBalance: 5000 });
    const { retainer, remainingBalance } = calculatePaymentSchedule(100.01);
    expect(retainer).toBe(50.01);
    expect(remainingBalance).toBe(50);
    expect(Math.round((retainer + remainingBalance) * 100)).toBe(10001);
  });

  it("never drifts on float-unfriendly totals", () => {
    for (const total of [0.1, 0.3, 19.99, 393.45, 1234.57]) {
      const { retainer, remainingBalance } = calculatePaymentSchedule(total);
      expect(Math.round(retainer * 100) + Math.round(remainingBalance * 100)).toBe(Math.round(total * 100));
      expect(Number.isInteger(Math.round(retainer * 100) / 1)).toBe(true);
    }
  });

  it("handles a zero total", () => {
    expect(calculatePaymentSchedule(0)).toEqual({ retainer: 0, remainingBalance: 0 });
    expect(calculatePaymentScheduleCents(0)).toEqual({ retainer: 0, remainingBalance: 0 });
  });
});

describe("graduation group duration minimum", () => {
  const { groupMinimumSize, groupMinimumMinutes } = PRICING_CATALOG.graduation.durationRules;

  it("is 90 minutes for groups of 3 or more", () => {
    expect(groupMinimumSize).toBe(3);
    expect(groupMinimumMinutes).toBe(90);
  });

  it("disallows 60 minutes for 3+ but allows it for 1–2", () => {
    expect(isSessionLengthAllowed(1, "1hr")).toBe(true);
    expect(isSessionLengthAllowed(2, "1hr")).toBe(true);
    expect(isSessionLengthAllowed(3, "1hr")).toBe(false);
    expect(isSessionLengthAllowed(6, "1hr")).toBe(false);
    expect(isSessionLengthAllowed(3, "1.5hr")).toBe(true);
  });

  it("raises a too-short pick to the minimum and keeps longer picks", () => {
    expect(enforceSessionLength(3, "1hr")).toBe("1.5hr");
    expect(enforceSessionLength(3, "2hr")).toBe("2hr");
    expect(enforceSessionLength(2, "1hr")).toBe("1hr");
  });

  it("never prices a 3+ group at 60 minutes, even when asked", () => {
    const estimate = calculateGraduationEstimate({ ...BASE, people: 3, sessionLength: "1hr" });
    expect(estimate.sessionLength).toBe("1.5hr");
    expect(estimate.groupNote).toMatch(/at least 90 minutes/);
  });
});

describe("graduation pricing", () => {
  const rates = PRICING_CATALOG.graduation.groupRates;
  const extra30 = PRICING_CATALOG.graduation.addOns.extra30Minutes.price;

  it("prices an individual session by the hour", () => {
    expect(calculateGraduationEstimate(BASE).sessionBase).toBe(350);
    expect(calculateGraduationEstimate({ ...BASE, sessionLength: "1.5hr" }).sessionBase).toBe(525);
    expect(calculateGraduationEstimate({ ...BASE, sessionLength: "2hr" }).sessionBase).toBe(700);
  });

  it.each([
    [2, rates[2] * 2],
    [3, rates[3] * 3],
    [4, rates[4] * 4],
    [5, rates[5] * 5],
    [6, rates[6] * 6],
    [8, rates[6] * 8],
  ])("prices %i graduates at the per-person rate for their included time", (people, expected) => {
    const length = people >= 3 ? "1.5hr" : "1hr";
    expect(calculateGraduationEstimate({ ...BASE, people, sessionLength: length }).sessionBase).toBe(expected);
  });

  it("includes the 90-minute group minimum in the group rate (matches the contract tool)", () => {
    expect(calculateGraduationEstimate({ ...BASE, people: 3, sessionLength: "1.5hr" }).sessionBase).toBe(825);
  });

  it("adds extra time past the included length as 30-minute add-ons", () => {
    expect(calculateGraduationEstimate({ ...BASE, people: 2, sessionLength: "1.5hr" }).sessionBase).toBe(600 + extra30);
    expect(calculateGraduationEstimate({ ...BASE, people: 3, sessionLength: "2hr" }).sessionBase).toBe(825 + extra30);
  });

  it("adds outfits, locations, expedited delivery, and champagne", () => {
    const a = PRICING_CATALOG.graduation.addOns;
    const estimate = calculateGraduationEstimate({ ...BASE, extraOutfit: true, secondLocation: true, expedited: true, champagne: true });
    expect(estimate.addons).toBe(a.extraOutfit.price + a.secondLocation.price + a.expedited.price + a.champagne.price);
    expect(estimate.subtotal).toBe(350 + estimate.addons);
  });

  it("adds a verified campus travel fee and keeps the split cent-exact", () => {
    const estimate = calculateGraduationEstimate({ ...BASE, school: "uc-berkeley" });
    const fee = PRICING_CATALOG.graduation.travelFees["uc-berkeley"];
    expect(estimate.travelMethod).toBe("mileage");
    expect(estimate.subtotal).toBe(350 + fee);
    expect(Math.round((estimate.deposit + estimate.remainingBalance) * 100)).toBe(Math.round(estimate.subtotal * 100));
  });

  it("marks travel as pending for an unverified location", () => {
    const estimate = calculateGraduationEstimate({ ...BASE, school: "other" });
    expect(estimate.travelMethod).toBe("tbd");
    expect(estimate.subtotal).toBe(350);
  });
});

describe("service prices the site quotes", () => {
  it("keeps the couples mini distinct from the full hour", () => {
    const { mini, "1hr": hour } = PRICING_CATALOG.couples.packages;
    expect([mini.price, mini.durationMinutes, mini.minimumImages]).toEqual([350, 30, 25]);
    expect([hour.price, hour.durationMinutes, hour.minimumImages]).toEqual([450, 60, 40]);
  });

  it("prices couples estimates from the package plus add-ons", () => {
    const estimate = calculateCouplesEstimate({
      packageKey: "1hr", location: "sf", extraLocation: true, extraOutfit: false,
      extra30Min: false, proofingGallery: true, rushPreview: false, expedited: false,
    });
    expect(estimate.subtotal).toBe(450 + 125 + 75);
    expect(estimate.travelMethod).toBe("none");
  });

  it("keeps proposals and elopements as separate services", () => {
    expect(PRICING_CATALOG.couples.packages.proposal.price).toBe(750);
    expect(PRICING_CATALOG.elopement.startingPrice).toBe(950);
    expect(PRICING_CATALOG.elopement.durationMinutes).toBe(120);
    expect(PRICING_CATALOG.elopement.addOns.extraLocation.price).toBe(125);
    expect(getMinimumImageCountForSessionType("Elopement / Courthouse Ceremony")).toBe(PRICING_CATALOG.elopement.minimumImages);
    expect(getMinimumImageCountForSessionType("Proposal")).toBe(PRICING_CATALOG.couples.packages.proposal.minimumImages);
  });

  it("prices maternity as its own $500 package", () => {
    const m = PRICING_CATALOG.maternity;
    expect([m.price, m.durationMinutes, m.minimumImages, m.locations, m.outfits]).toEqual([500, 60, 30, 1, 1]);
    expect([m.addOns.extraOutfit.price, m.addOns.secondLocation.price, m.addOns.expedited.price]).toEqual([75, 125, 150]);
    expect(getMinimumImageCountForSessionType("Maternity Session")).toBe(30);
  });

  it("keeps the family packages unchanged", () => {
    const { standard, extended } = PRICING_CATALOG.families.packages;
    expect([standard.price, standard.durationMinutes, standard.minimumImages]).toEqual([350, 30, 10]);
    expect([extended.price, extended.durationMinutes, extended.minimumImages]).toEqual([500, 60, 30]);
  });

  it("offers no video add-on", () => {
    expect(JSON.stringify(PRICING_CATALOG).toLowerCase()).not.toMatch(/video|reel/);
  });
});
