// The universal travel fee: $0.70 per round-trip mile from San Francisco,
// rounded up to the next $5, plus tolls actually paid, with that total then
// rounded to the nearest $5. SF is included.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TOLL_BRIDGES,
  VERIFIED_ROUTES,
  calculateTravelFee,
  mileageChargeCents,
  roundTravelFeeToNearestFive,
  supersededTravelFees,
  tollChargeCents,
  verifiedTravelFee,
} from "@/lib/travelFee";
import {
  PRICING_CATALOG,
  getGraduationTravelFeeFromText,
} from "@/lib/pricingCatalog";
import { calculateCouplesEstimate, calculateGraduationEstimate, formatCurrency } from "@/lib/pricing";
import { catalogSessionTotalCents } from "@/lib/paymentTotalInference";
import { buildTravelFact } from "@/lib/ai/businessFacts";

const noTolls = [] as const;

describe("mileage", () => {
  it("doubles a one-way distance for a same-route return", () => {
    expect(calculateTravelFee({ outboundMiles: 20, returnMiles: 20, crossings: noTolls }).roundTripMiles).toBe(40);
  });

  it("uses the real round trip when the return differs", () => {
    expect(calculateTravelFee({ outboundMiles: 23.21, returnMiles: 20.9, crossings: noTolls }).roundTripMiles).toBe(44.11);
  });

  it("charges $0.70 a mile and leaves an exact $5 step alone", () => {
    expect(mileageChargeCents(50)).toBe(3500);
  });

  it("rounds the mileage charge up to the next $5", () => {
    expect(mileageChargeCents(40)).toBe(3000); // $28.00 -> $30
    expect(mileageChargeCents(71.44)).toBe(5500); // $50.008 -> $55, a cent over still steps up
    expect(mileageChargeCents(65.75)).toBe(5000); // $46.025 -> $50
  });

  it("is exact in cents where floats would drift", () => {
    // 0.1 + 0.2 style inputs must not tip a boundary.
    expect(mileageChargeCents(0.1 + 0.2)).toBe(500);
    expect(mileageChargeCents(500 / 70)).toBe(500); // 7.14 mi = $4.998
  });
});

describe("tolls", () => {
  it("charges a bridge only in the direction it collects", () => {
    expect(tollChargeCents([{ bridge: "bayBridge", heading: "eastbound" }])).toBe(0);
    expect(tollChargeCents([{ bridge: "bayBridge", heading: "westbound" }])).toBe(850);
  });

  it("charges an out-and-back crossing once, not twice", () => {
    const fee = calculateTravelFee(VERIFIED_ROUTES["uc-berkeley"]);
    expect(fee.tollCents).toBe(850);
  });

  it("adds the toll to the cent after rounding the mileage, then rounds the total to the nearest $5", () => {
    expect(calculateTravelFee({
      outboundMiles: 25,
      returnMiles: 25,
      crossings: [{ bridge: "bayBridge", heading: "eastbound" }, { bridge: "bayBridge", heading: "westbound" }],
    })).toEqual({ roundTripMiles: 50, mileageCents: 3500, tollCents: 850, subtotalCents: 4350, totalCents: 4500 });
  });
});

describe("final nearest-$5 rounding", () => {
  it.each([
    [3000, 3000], [3100, 3000], [3250, 3500], [3350, 3500], [3500, 3500], [3600, 3500],
    [3750, 4000], [4100, 4000], [4350, 4500], [4750, 5000], [5000, 5000], [6350, 6500],
  ])("rounds %i cents to %i", (subtotal, expected) => {
    expect(roundTravelFeeToNearestFive(subtotal)).toBe(expected);
  });

  it("includes the toll before rounding, never rounding the components on their own", () => {
    // Mileage $35 (already a $5 step) + $8.50 toll = $43.50 -> $45, not $35 + $10.
    const fee = calculateTravelFee(VERIFIED_ROUTES["uc-berkeley"]);
    expect([fee.mileageCents, fee.tollCents, fee.subtotalCents, fee.totalCents]).toEqual([3500, 850, 4350, 4500]);
  });

  it("leaves a toll-free route alone, since its mileage charge is already a $5 step", () => {
    const fee = calculateTravelFee(VERIFIED_ROUTES.stanford);
    expect(fee.subtotalCents).toBe(fee.totalCents);
  });

  it("makes every verified fee a multiple of $5", () => {
    for (const key of Object.keys(VERIFIED_ROUTES) as (keyof typeof VERIFIED_ROUTES)[]) {
      expect(verifiedTravelFee(key) % 5).toBe(0);
      expect(Number.isInteger(verifiedTravelFee(key))).toBe(true);
    }
  });

  it("leaves an approved fee untouched", () => {
    expect(verifiedTravelFee("sjsu")).toBe(75);
  });

  it("reports the unrounded sum and the replaced formula fee as superseded figures", () => {
    expect(supersededTravelFees("uc-berkeley")).toEqual([43.5]);
    expect(supersededTravelFees("csueb")).toEqual([63.5]);
    expect(supersededTravelFees("sjsu")).toEqual([70]);
    expect(supersededTravelFees("stanford")).toEqual([]);
  });
});

describe("verified routes", () => {
  it("carry measured legs and only bridges with a verified toll", () => {
    for (const route of Object.values(VERIFIED_ROUTES)) {
      expect(route.outboundMiles).toBeGreaterThan(0);
      expect(route.returnMiles).toBeGreaterThan(0);
      expect(route.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const { bridge } of route.crossings) expect(TOLL_BRIDGES[bridge].cents).toBeGreaterThan(0);
    }
  });

  it("price every out-of-city campus from the policy", () => {
    expect(verifiedTravelFee("uc-berkeley")).toBe(45); // $35 mileage + $8.50 toll = $43.50, to the nearest $5
    expect(verifiedTravelFee("csueb")).toBe(65); // $55 + $8.50 = $63.50, to the nearest $5
    expect(verifiedTravelFee("sjsu")).toBe(75); // approved fee; the formula alone gives $70
    expect(verifiedTravelFee("santa-clara")).toBe(65);
    expect(verifiedTravelFee("stanford")).toBe(50);
  });
});

describe("one fee everywhere", () => {
  it("has no rate-card fee that bypasses the policy", () => {
    const grad = PRICING_CATALOG.graduation.travelFees;
    for (const key of Object.keys(VERIFIED_ROUTES) as (keyof typeof VERIFIED_ROUTES)[]) {
      expect(grad[key]).toBe(verifiedTravelFee(key));
    }
    const couples = PRICING_CATALOG.couples.travelFees;
    expect(couples.berkeley).toBe(verifiedTravelFee("uc-berkeley"));
    expect(couples["santa-clara"]).toBe(verifiedTravelFee("santa-clara"));
    // Areas, not destinations: confirmed for the exact spot, never a guess.
    expect([couples.oakland, couples.peninsula, couples["south-bay"], couples.other]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("includes San Francisco", () => {
    const grad = PRICING_CATALOG.graduation.travelFees;
    expect([grad["sf-state"], grad.usf, grad["sf-other"], PRICING_CATALOG.couples.travelFees.sf]).toEqual([null, null, null, null]);
    expect(calculateGraduationEstimate({ school: "usf", people: 1, sessionLength: "1hr", extraOutfit: false, secondLocation: false, expedited: false, champagne: false }).subtotal).toBe(350);
  });

  it("matches the Pixieset extension's copy", () => {
    const source = readFileSync("pixieset-extension/content.js", "utf8");
    const block = source.match(/const TRAVEL_FEES = \{([\s\S]*?)\};/)?.[1] ?? "";
    const extension = Object.fromEntries([...block.matchAll(/"([\w-]+)":\s*([\d.]+)/g)].map(([, k, v]) => [k, Number(v)]));
    for (const key of Object.keys(VERIFIED_ROUTES) as (keyof typeof VERIFIED_ROUTES)[]) {
      expect(extension[key]).toBe(verifiedTravelFee(key));
    }
  });

  it("gives the same session total on the estimator, the confirmation, and the contract", () => {
    const estimate = calculateGraduationEstimate({ school: "uc-berkeley", people: 1, sessionLength: "1hr", extraOutfit: false, secondLocation: false, expedited: false, champagne: false });
    expect(estimate.subtotal).toBe(395);
    expect(formatCurrency(estimate.subtotal)).toBe("$395");
    expect(estimate.deposit).toBe(197.5);
    expect(estimate.remainingBalance).toBe(197.5);
    expect(catalogSessionTotalCents({ session_type: "Graduation", school: "UC Berkeley", message: "", location: null, people: 1 })).toBe(39500);
    expect(getGraduationTravelFeeFromText("stanford grad")).toBe(50);
    expect(calculateCouplesEstimate({ packageKey: "1hr", location: "santa-clara", extraLocation: false, extraOutfit: false, extra30Min: false, proofingGallery: false, rushPreview: false, expedited: false }).subtotal).toBe(515);
  });
});

describe("the AI gets the fee as a fact", () => {
  it("recognises universities and states their verified fee", () => {
    expect(buildTravelFact("Stanford University", null)).toContain("Travel fee for Stanford University: $50.");
    expect(buildTravelFact("Cal State East Bay", null)).toContain("$65.");
    expect(buildTravelFact(null, "Santa Clara University")).toContain("$65.");
    expect(buildTravelFact("UC Berkeley", null)).toContain("Travel fee for UC Berkeley: $45.");
    expect(buildTravelFact("UC Berkeley", null)).toContain("verified fee");
  });

  it("does not re-ask for a destination it already has", () => {
    const fact = buildTravelFact("San Jose State University", null) ?? "";
    expect(fact).not.toMatch(/settle the location|confirm the location|where/i);
    const unknown = buildTravelFact(null, "Filoli Garden") ?? "";
    expect(unknown).not.toMatch(/once we settle/);
    expect(unknown).toMatch(/do not ask them to confirm the location again/);
  });

  it("never invents a fee for a place without a verified route", () => {
    const fact = buildTravelFact(null, "Point Reyes") ?? "";
    expect(fact).toMatch(/NOT in the rate card/);
    expect(fact).not.toMatch(/\$\d/);
  });

  it("carries no stray dollar figure the validator would treat as quotable", () => {
    const fact = buildTravelFact("San Jose State University", null) ?? "";
    expect([...fact.matchAll(/\$\d[\d,]*(?:\.\d{2})?/g)].map(([m]) => m)).toEqual(["$75"]);
  });
});
