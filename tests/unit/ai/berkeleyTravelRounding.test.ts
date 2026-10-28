// UC Berkeley's travel fee is $45 on every surface: $35 mileage + $8.50 Bay
// Bridge toll = $43.50, rounded to the nearest $5. The AI gets $45 as a fact,
// a draft that still says $43.50 / $393.50 is flagged and corrected to
// $45 / $395, and the estimator, payment totals and contract agree.

import { describe, expect, it } from "vitest";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { validateEmailDraft, quoteInputOf } from "@/lib/ai/validateEmailDraft";
import { authoritativeQuote, staleQuotedPrices, parseQuotedPrices } from "@/lib/ai/quotePricing";
import { buildThreadDigest } from "@/lib/ai/threadDigest";
import { generateDraft } from "@/lib/ai/emailOperations";
import { resolveContractPricing } from "@/lib/contractPricing";
import { calculateGraduationEstimate } from "@/lib/pricing";
import { calculatePaymentSchedule } from "@/lib/pricingCatalog";
import { catalogSessionTotalCents } from "@/lib/paymentTotalInference";
import { AVAILABILITY, NOW, fakeCaller, inquiry, message } from "./fixtures";

const SCHOOL = "University of California, Berkeley";

function berkeley(thread: ReturnType<typeof message>[] = []) {
  return buildEmailContext({
    inquiry: inquiry({ school: SCHOOL, location: "UC Berkeley", people: 1 }),
    messages: thread, availability: AVAILABILITY, threadLoaded: true, now: NOW,
  });
}

const OLD_DRAFT = "Hi Jaqueline,\n\nMy graduation sessions start at $350 for a 1-hour session, plus a travel fee of $43.50 for UC Berkeley, so $393.50 total";
const GOOD_DRAFT = "Hi Jaqueline,\n\nMy graduation sessions start at $350 for a 1-hour session, plus a travel fee of $45 for UC Berkeley, so $395 total";

describe("UC Berkeley after the nearest-$5 rounding", () => {
  it("gives the AI $45 as the verified fact, never $43.50", () => {
    const fact = berkeley().pricing.travelFact ?? "";
    expect(fact).toContain("Travel fee for UC Berkeley: $45.");
    expect(fact).not.toContain("43.5");
  });

  it("prices the session at $350 + $45 = $395", () => {
    expect(authoritativeQuote(quoteInputOf(berkeley()))).toEqual({
      lines: [
        { kind: "session", label: "Graduation session", amount: 350 },
        { kind: "travel", label: "Travel fee (UC Berkeley)", amount: 45 },
      ],
      total: 395,
    });
  });

  it("flags a draft that still quotes $43.50 and $393.50", () => {
    const result = validateEmailDraft(OLD_DRAFT, berkeley());
    expect(result.issues.filter((i) => i.type === "pricing_mismatch").map((i) => i.description)).toEqual([
      "States a $43.50 travel fee; the verified fee is $45.",
      "States a $393.50 total; the rate card gives $395.",
    ]);
    expect(result.factsVerified).toBe(false);
  });

  it("passes a draft that quotes $45 and $395", () => {
    const result = validateEmailDraft(GOOD_DRAFT, berkeley());
    expect(result.issues.map((i) => i.type)).not.toContain("pricing_mismatch");
    expect(result.factsVerified).toBe(true);
  });

  it("corrects the model's $43.50 / $393.50 to $45 / $395 before the draft is shown", async () => {
    const result = await generateDraft({
      inquiry: inquiry({ school: SCHOOL, location: "UC Berkeley", people: 1 }),
      messages: [], availability: AVAILABILITY, threadLoaded: true, now: NOW, rules: [], threadText: null,
    }, fakeCaller(OLD_DRAFT));
    expect(result.draft).toBe(GOOD_DRAFT);
    expect(result.pricing.corrections.map((c) => [c.kind, c.stated, c.expected])).toEqual([["travel", 43.5, 45], ["total", 393.5, 395]]);
  });

  it("treats an earlier email's $393.50 as an outdated quote, not the current price", () => {
    const thread = [message("My sessions start at $350, plus a $43.50 travel fee for UC Berkeley, so $393.50 total", true, 5)];
    const input = quoteInputOf(berkeley(thread));
    const quoted = parseQuotedPrices(buildThreadDigest(thread).quotedPrices);
    expect(staleQuotedPrices(quoted, input, thread)).toEqual(expect.arrayContaining([43.5, 393.5]));
    expect(berkeley(thread).pricing.stalePrices).toEqual(expect.arrayContaining([393.5]));
  });

  it("calls a $393.50 agreed total stale on the contract until confirmed", () => {
    const pricing = resolveContractPricing(
      { sessionType: "Graduation", school: SCHOOL, location: "UC Berkeley", message: "", people: 1,
        messages: [message("plus a $43.50 travel fee for UC Berkeley, so $393.50 total", true, 5)] },
      { agreedTotal: 393.5, sessionPrice: null, addOns: [], travelFee: null, includesTravel: true },
    );
    expect(pricing.status).toBe("review");
    expect(pricing.status === "review" && pricing.reason).toMatch(/outdated travel fee.*\$45/);
  });

  it("agrees across the estimator, payment totals and the contract", () => {
    const estimate = calculateGraduationEstimate({ school: "uc-berkeley", people: 1, sessionLength: "1hr", extraOutfit: false, secondLocation: false, expedited: false, champagne: false });
    expect([estimate.travelFee, estimate.subtotal, estimate.deposit, estimate.remainingBalance]).toEqual([45, 395, 197.5, 197.5]);
    expect(calculatePaymentSchedule(395)).toEqual({ retainer: 197.5, remainingBalance: 197.5 });
    expect(catalogSessionTotalCents({ session_type: "Graduation", school: SCHOOL, message: "", location: "UC Berkeley", people: 1 })).toBe(39500);
    const contract = resolveContractPricing(
      { sessionType: "Graduation", school: SCHOOL, location: "UC Berkeley", message: "", people: 1 },
      { agreedTotal: null, sessionPrice: 350, addOns: [], travelFee: null, includesTravel: null },
    );
    expect(contract.status).toBe("ok");
    expect(contract.total).toBe(395);
  });
});
