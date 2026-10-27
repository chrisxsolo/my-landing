// SJSU is billed the approved $75 travel fee everywhere, not the $70 the
// mileage formula gives (97.98 round-trip miles x $0.70 = $68.59, up to $70).
//
// One session, every surface: estimator, catalog, FAQ, landing copy, payment
// totals, Pixieset extension, Draft AI facts, examples and validation.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculatedTravelFee, travelFeeBasis, verifiedTravelFee, VERIFIED_ROUTES, TRAVEL_POLICY } from "@/lib/travelFee";
import { PRICING_CATALOG, getGraduationTravelNote, calculatePaymentSchedule } from "@/lib/pricingCatalog";
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
  it("prices one graduate at $350 + $75 = $425", () => {
    const estimate = grad(1);
    expect([estimate.sessionBase, estimate.travelFee, estimate.subtotal]).toEqual([350, 75, 425]);
    expect(estimate.deposit + estimate.remainingBalance).toBe(425);
  });

  it("prices two graduates at $600 + $75 = $675", () => {
    const estimate = grad(2);
    expect([estimate.sessionBase, estimate.travelFee, estimate.subtotal]).toEqual([600, 75, 675]);
  });

  it("uses $75 in the catalog, landing copy and FAQ", () => {
    expect(PRICING_CATALOG.graduation.travelFees.sjsu).toBe(75);
    expect(getTravelFeeForSchool("sjsu")).toBe(75);
    expect(getGraduationTravelNote("sjsu")).toBe("SJSU sessions include a $75 travel fee from San Francisco.");
    const faq = JSON.stringify(FAQS);
    expect(faq).toContain("SJSU ($75)");
    expect(faq).not.toContain("SJSU ($70)");
  });

  it("totals payments at $425 / $675", () => {
    const base = { session_type: "Graduation", school: "San Jose State University", message: "", location: null };
    expect(catalogSessionTotalCents({ ...base, people: 1 })).toBe(42500);
    expect(catalogSessionTotalCents({ ...base, people: 2 })).toBe(67500);
    expect(calculatePaymentSchedule(425)).toEqual({ retainer: 212.5, remainingBalance: 212.5 });
  });

  it("matches the Pixieset extension", () => {
    const source = readFileSync("pixieset-extension/content.js", "utf8");
    expect(source).toMatch(/"sjsu":\s*75\b/);
  });

  it("gives Draft AI the approved fee as its fact", () => {
    expect(buildTravelFact("SJSU", null)).toContain("Travel fee for SJSU: $75.");
  });

  it("teaches Draft AI no outdated SJSU figure in its seed examples", () => {
    const sjsu = SEED_EXAMPLES.filter((e) => /san jose state|sjsu/i.test(e.body));
    expect(sjsu.length).toBeGreaterThan(0);
    for (const e of sjsu) expect(e.body).not.toMatch(/\$(?:70|420|670)\b/);
    expect(sjsu.map((e) => e.body).join("\n")).toMatch(/\$75 travel fee for SJSU, so \$425 total/);
  });
});
