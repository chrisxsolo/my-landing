// The graduation FAQ prints each campus travel fee the way every other
// surface does: whole dollars bare, a toll-adjusted fee with two decimals.
// It used to interpolate the raw number, so UC Berkeley read "$43.5".

import { describe, expect, it } from "vitest";
import { FAQS } from "@/app/(professional)/faq/graduation/graduationFaqData";
import { PRICING_CATALOG, formatFee } from "@/lib/pricingCatalog";

const travelAnswer = () =>
  FAQS.flatMap((group) => group.items).find((item) => item.q === "Is there a travel fee?")?.a ?? "";

describe("graduation FAQ travel fees", () => {
  it("formats every campus fee with formatFee", () => {
    const fees = PRICING_CATALOG.graduation.travelFees;
    for (const key of ["uc-berkeley", "csueb", "santa-clara", "sjsu", "stanford"] as const) {
      expect(travelAnswer()).toContain(`(${formatFee(fees[key])})`);
    }
  });

  it("never prints a single-decimal dollar amount", () => {
    expect(travelAnswer()).not.toMatch(/\$\d+\.\d(?!\d)/);
  });
});
