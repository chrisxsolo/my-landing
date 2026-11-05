// SJSU is billed the approved $75 travel fee everywhere, not the $70 the
// mileage formula gives (97.98 round-trip miles x $0.70 = $68.59, up to $70).
//
// One session, every surface: estimator, catalog, FAQ, landing copy, payment
// totals, Pixieset extension, Draft AI facts, examples and validation.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculatedTravelFee, travelFeeBasis, verifiedTravelFee, VERIFIED_ROUTES, TRAVEL_POLICY } from "@/lib/travelFee";
import { PRICING_CATALOG, calculatePaymentSchedule } from "@/lib/pricingCatalog";
import { calculateGraduationEstimate, getTravelFeeForSchool } from "@/lib/pricing";
import { catalogSessionTotalCents } from "@/lib/paymentTotalInference";
import { buildTravelFact } from "@/lib/ai/businessFacts";
import { SEED_EXAMPLES } from "@/lib/ai/approvedExamples";
import { FAQS } from "@/app/(professional)/faq/graduation/graduationFaqData";

const grad = (people: number) => calculateGraduationEstimate({
  school: "sjsu", people, sessionLength: people >= 3 ? "1.5hr" : "1hr",
  extraOutfit: false, secondLocation: false, expedited: false, champagne: false,
});

describe("the approved SJSU fee", () => {
  it("is $75, with the mileage formula kept for reference", () => {
    expect(verifiedTravelFee("sjsu")).toBe(75);
    expect(calculatedTravelFee("sjsu")).toBe(70);
    expect(travelFeeBasis("sjsu")).toEqual({ fee: 75, calculatedFee: 70, roundTripMiles: 97.98, source: "approved" });
  });

  it("does not bend the distance or the global rate to get there", () => {
    expect(VERIFIED_ROUTES.sjsu.outboundMiles + VERIFIED_ROUTES.sjsu.returnMiles).toBeCloseTo(97.98, 2);
    expect(TRAVEL_POLICY.ratePerMileCents).toBe(70);
  });

  it("leaves every other campus on the formula", () => {
    for (const key of ["uc-berkeley", "csueb", "santa-clara", "stanford"] as const) {
      expect(verifiedTravelFee(key)).toBe(calculatedTravelFee(key));
      expect(travelFeeBasis(key).source).toBe("mileage");
    }
  });
});

describe("one SJSU price on every surface", () => {
  it("prices one graduate at $425 + $75 = $500 for the hour, $325 + $75 = $400 for the mini", () => {
    const estimate = grad(1);
    expect([estimate.sessionBase, estimate.travelFee, estimate.subtotal]).toEqual([425, 75, 500]);
    expect(estimate.deposit + estimate.remainingBalance).toBe(500);
    const mini = calculateGraduationEstimate({ school: "sjsu", people: 1, sessionLength: "30min", extraOutfit: false, secondLocation: false, expedited: false, champagne: false });
    expect([mini.sessionBase, mini.travelFee, mini.subtotal]).toEqual([325, 75, 400]);
  });

  it("prices two graduates at $700 + $75 = $775", () => {
    const estimate = grad(2);
    expect([estimate.sessionBase, estimate.travelFee, estimate.subtotal]).toEqual([700, 75, 775]);
  });

  it("uses $75 in the catalog, landing copy and FAQ", () => {
    expect(PRICING_CATALOG.graduation.travelFees.sjsu).toBe(75);
    expect(getTravelFeeForSchool("sjsu")).toBe(75);
    const faq = JSON.stringify(FAQS);
    expect(faq).toContain("SJSU ($75)");
    expect(faq).not.toContain("SJSU ($70)");
  });

  it("totals payments at $500 / $775", () => {
    const base = { session_type: "Graduation", school: "San Jose State University", message: "", location: null };
    expect(catalogSessionTotalCents({ ...base, people: 1, message: "1 hour session" })).toBe(50000);
    expect(catalogSessionTotalCents({ ...base, people: 2 })).toBe(77500);
    expect(calculatePaymentSchedule(500)).toEqual({ retainer: 250, remainingBalance: 250 });
  });

  it("matches the Pixieset extension", () => {
    const source = readFileSync("pixieset-extension/extensionPricing.js", "utf8");
    expect(source).toMatch(/"sjsu":\s*75\b/);
  });

  it("gives Draft AI the approved fee as its fact", () => {
    expect(buildTravelFact("SJSU", null)).toContain("Travel fee for SJSU: $75.");
  });

  it("teaches Draft AI no outdated SJSU figure in its seed examples", () => {
    const sjsu = SEED_EXAMPLES.filter((e) => /san jose state|sjsu/i.test(e.body));
    expect(sjsu.length).toBeGreaterThan(0);
    for (const e of sjsu) expect(e.body).not.toMatch(/\$(?:70|420|495|670|770)\b/);
    expect(sjsu.map((e) => e.body).join("\n")).toMatch(/\$75 travel fee for SJSU, so \$500 total/);
  });
});
