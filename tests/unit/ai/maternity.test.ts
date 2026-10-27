// Maternity has one published package, and Draft AI now knows it.
//
// Before, no classifier key matched "maternity", so the inquiry fell through
// to family or couples (or nothing) and was quoted those rates.

import { describe, expect, it } from "vitest";
import { classifySession, resolvePlaybookKey } from "@/lib/ai/sessionClassifier";
import { buildPricingFacts } from "@/lib/ai/businessFacts";
import { getPlaybook } from "@/lib/ai/soloxsnapsWritingProfile";
import { resolveContractPricing, type ExtractedPricing } from "@/lib/contractPricing";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";

const maternity = PRICING_CATALOG.maternity;
const none: ExtractedPricing = { agreedTotal: null, sessionPrice: null, addOns: [], travelFee: null, includesTravel: null };

describe("maternity classification", () => {
  it("reads the dropdown value", () => {
    expect(resolvePlaybookKey("Maternity Session", "")).toBe("maternity");
  });

  it("reads maternity requests from the message", () => {
    expect(resolvePlaybookKey("Other", "Looking for maternity photos in December")).toBe("maternity");
    expect(resolvePlaybookKey(null, "I'm 30 weeks pregnant and would love a shoot")).toBe("maternity");
  });

  it("keeps partner and kids inside the maternity session", () => {
    const withKids = classifySession("Family Session", "Maternity photos with our two kids and my husband");
    expect(withKids.key).toBe("maternity");
    expect(withKids.ambiguous).toBe(false);
    const withPartner = classifySession(null, "Maternity photos of me and my husband");
    expect(withPartner.key).toBe("maternity");
    expect(withPartner.ambiguous).toBe(false);
  });

  it("has its own writing playbook", () => {
    expect(getPlaybook("Maternity Session", "")).toContain("never move them to a family package");
  });
});

describe("maternity pricing facts", () => {
  const facts = buildPricingFacts({ sessionType: "Maternity Session", message: "Maternity shoot please" });

  it("quotes the catalog package", () => {
    expect(facts.verified).toBe(true);
    expect(facts.basePrices).toEqual([maternity.price]);
    expect(facts.lines[0]).toContain(`$${maternity.price}`);
    expect(facts.lines[0]).toContain(`${maternity.minimumImages}+ edited images`);
  });

  it("lists the catalog add-ons and no per-mile rate", () => {
    const { extraOutfit, secondLocation, expedited } = maternity.addOns;
    expect(facts.addOnPrices).toEqual([extraOutfit.price, secondLocation.price, expedited.price]);
    expect(facts.lines.join(" ")).not.toMatch(/\$0\.\d+/);
  });
});

describe("maternity contracts", () => {
  it("routes a bare $500 agreed total to review when travel applies", () => {
    const pricing = resolveContractPricing(
      { sessionType: "Maternity Session", school: null, location: "Oakland Rose Garden", message: "Maternity photos" },
      { ...none, agreedTotal: maternity.price },
    );
    expect(pricing.status).toBe("review");
  });

  it("uses the agreed total in San Francisco", () => {
    const pricing = resolveContractPricing(
      { sessionType: "Maternity Session", school: null, location: "Golden Gate Park", message: "Maternity photos" },
      { ...none, agreedTotal: maternity.price },
    );
    expect(pricing).toMatchObject({ status: "ok", total: maternity.price });
  });
});
