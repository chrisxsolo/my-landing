// A school stands in for the shoot location only for a graduation.
//
// The contract already applied that rule; Draft AI did not, so a couples
// client who listed SJSU as their school was told about a $75 travel fee in
// the email and then billed $0 on the contract.

import { describe, expect, it } from "vitest";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { resolveContractPricing, type ExtractedPricing } from "@/lib/contractPricing";
import { schoolImpliesLocationFor } from "@/lib/travelResolution";
import { AVAILABILITY, NOW, inquiry } from "./fixtures";

const context = (overrides: Parameters<typeof inquiry>[0]) => buildEmailContext({
  inquiry: inquiry(overrides), messages: [], availability: AVAILABILITY, threadLoaded: true, now: NOW,
});

const none: ExtractedPricing = { agreedTotal: null, sessionPrice: null, addOns: [], travelFee: null, includesTravel: null };

describe("school implies location only for graduation", () => {
  it("is a single rule", () => {
    expect(schoolImpliesLocationFor("graduation")).toBe(true);
    for (const service of ["couples", "maternity", "elopement", null]) {
      expect(schoolImpliesLocationFor(service)).toBe(false);
    }
  });

  it("gives a couples client from SJSU no travel fee in the AI, matching the contract", () => {
    const couples = { sessionType: "Couples Session", school: "San Jose State", message: "We'd love a couples session." };
    const ctx = context(couples);
    expect(ctx.client.playbook).toBe("couples");
    expect(ctx.pricing.travel.kind).toBe("none");
    expect(ctx.pricing.travelFact ?? "").not.toContain("$75");

    const contract = resolveContractPricing(
      { sessionType: couples.sessionType, school: couples.school, location: null, message: couples.message },
      { ...none, sessionPrice: 450 },
    );
    expect(contract.total).toBe(450);
  });

  it("still bills an SJSU graduate the $75 fee on both surfaces", () => {
    const grad = { sessionType: "Graduation", school: "San Jose State", message: "Grad photos please" };
    const ctx = context(grad);
    expect(ctx.pricing.travel).toMatchObject({ kind: "verified", fee: 75 });
    expect(ctx.pricing.travelFact).toContain("$75");

    const contract = resolveContractPricing(
      { sessionType: grad.sessionType, school: grad.school, location: null, message: grad.message },
      { ...none, sessionPrice: 350 },
    );
    expect(contract.total).toBe(425);
  });

  it("still reads a couples shoot location when one is named", () => {
    const ctx = context({ sessionType: "Couples Session", school: "SJSU", location: "San Jose State campus", message: "Couples session" });
    expect(ctx.pricing.travel).toMatchObject({ kind: "verified", fee: 75 });
  });
});
