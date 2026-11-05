// The one duration parser every money path reads (quote check, payment
// inference, contract pricing, invoice draft) and the browser mirror the
// PixiSet extension carries. A 90-minute request read as the 30-minute mini
// is a wrong contract, so compound forms are matched whole, unrelated time
// spans lose to session wording, and genuine conflicts come back null.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { detectGraduationDurationMinutes } from "@/lib/pricing";
import { catalogSessionTotalCents } from "@/lib/paymentTotalInference";
import { resolveContractPricing, type ExtractedPricing } from "@/lib/contractPricing";
import { buildInvoiceDraft } from "@/lib/invoiceDraft/build";
import { NO_FACTS } from "@/lib/invoiceDraft/types";

const CASES: [string, number | null][] = [
  // the four lengths the rate card knows, in the words clients use
  ["30 minutes", 30], ["a 30 minute mini", 30], ["half hour", 30], ["half an hour", 30], ["the mini", 30],
  ["60 minutes", 60], ["1 hour", 60], ["a 1-hour session", 60], ["an hour", 60], ["one hour", 60], ["full hour", 60],
  ["90 minutes", 90], ["1.5 hours", 90], ["1.5hours", 90],
  ["120 minutes", 120], ["2 hours", 120], ["two hours", 120], ["2hr", 120],
  // compound forms are one duration, never their first number
  ["1 hour 30 minutes", 90], ["1 hr and 30 min", 90], ["one hour and thirty minutes", 90],
  ["an hour and a half", 90], ["hour and a half", 90], ["one and a half hours", 90], ["1 1/2 hours", 90],
  ["1 hour plus 30 minutes", 90], ["2 hours and 30 minutes", 150],
  // session wording outranks delivery and availability spans
  ["photos back within 30 days, and a 1-hour session on campus", 60],
  ["the gallery is delivered in 2 hours; we want the 30 minute mini", 30],
  ["I can reply within an hour. Session length: 30 minutes", 30],
  ["we would arrive 30 minutes early for a 1 hour session", 60],
  // the same length named twice is not a conflict
  ["the 1 hour session, so an hour of photos", 60],
  ["Session length: 30 minutes (the mini)", 30],
  // genuinely conflicting packages: nobody picks for the client
  ["the 1 hour session, or maybe the 30 minute mini if cheaper", null],
  ["30 minutes or an hour, whichever you suggest", null],
  // nothing named
  ["Grad photos for me, graduating in May", null], ["", null],
];

describe("detectGraduationDurationMinutes", () => {
  it.each(CASES)("%j → %j", (text, minutes) => {
    expect(detectGraduationDurationMinutes(text)).toBe(minutes);
  });

  it("accepts null and undefined", () => {
    expect(detectGraduationDurationMinutes(null)).toBeNull();
    expect(detectGraduationDurationMinutes(undefined)).toBeNull();
  });
});

describe("a conflicting length forces review downstream instead of a first-match total", () => {
  const conflicted = {
    session_type: "Graduation", school: "San Jose State University", location: null, people: "1",
    message: "the 1 hour session, or maybe the 30 minute mini if cheaper",
  };
  const NO_PRICE: ExtractedPricing = { agreedTotal: null, sessionPrice: null, addOns: [], travelFee: null, includesTravel: null };

  it("payment inference names no total", () => {
    expect(catalogSessionTotalCents(conflicted)).toBe(0);
  });

  it("the contract offers both packages and asks", () => {
    const pricing = resolveContractPricing({ sessionType: "Graduation", school: conflicted.school, location: null, message: conflicted.message, people: 1 }, NO_PRICE);
    expect(pricing.status).toBe("review");
  });

  it("the invoice draft stays in review with both packages as options", () => {
    const draft = buildInvoiceDraft(
      { id: 1, name: "Test Grad", email: "grad@example.com", school: conflicted.school, location: null, people: "1", session_type: "Graduation", message: conflicted.message, date_in_mind: null },
      NO_FACTS,
    );
    expect(draft.status).toBe("review");
    expect(draft.pricing.totalCents).toBeNull();
    expect(draft.reviewReasons.join(" ")).toMatch(/does not say which package.*Graduation Mini \(30 min\) \$325 or Graduation Session \(60 min\) \$425/);
  });

  it("a 90-minute request is never priced as the mini", () => {
    expect(catalogSessionTotalCents({ ...conflicted, message: "1 hour 30 minutes on campus" })).toBe((525 + 75) * 100);
    expect(catalogSessionTotalCents({ ...conflicted, message: "1 hr and 30 min" })).toBe((525 + 75) * 100);
  });
});

describe("the PixiSet extension mirrors the parser", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("pixieset-extension/extensionPricing.js", "utf8"), context);
  const mirror = (text: string) => vm.runInContext("detectGradDurationMinutes", context)(text) as number | null;

  it.each(CASES)("%j → %j in the browser too", (text, minutes) => {
    expect(mirror(text)).toBe(minutes);
  });
});
