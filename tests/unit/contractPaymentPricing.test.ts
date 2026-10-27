// Contracts and payment totals price the session that is actually booked,
// at the place it is actually shot, and never add travel on top of a total
// that already includes it.

import { describe, expect, it } from "vitest";
import { resolveContractPricing, type ExtractedPricing } from "@/lib/contractPricing";
import { catalogSessionTotalCents, inferSessionTotalCents } from "@/lib/paymentTotalInference";

const none: ExtractedPricing = { agreedTotal: null, sessionPrice: null, addOns: [], travelFee: null, includesTravel: null };
const sjsuGrad = { sessionType: "Graduation", school: "San Jose State University", location: null, message: "" };

describe("contract pricing", () => {
  it("keeps an agreed all-inclusive $425 at $425 (was $500)", () => {
    const pricing = resolveContractPricing(sjsuGrad, { ...none, agreedTotal: 425, includesTravel: true });
    expect(pricing).toMatchObject({ status: "ok", total: 425 });
  });

  it("never adds travel to an agreed total that matches session + travel", () => {
    const pricing = resolveContractPricing(sjsuGrad, { ...none, agreedTotal: 425 });
    expect(pricing).toMatchObject({ status: "ok", total: 425 });
  });

  it("builds session + add-ons + approved travel when only the session price is known", () => {
    const pricing = resolveContractPricing(sjsuGrad, {
      ...none, sessionPrice: 350, addOns: [{ label: "Extra outfit", amount: 75 }],
    });
    expect(pricing.status).toBe("ok");
    expect(pricing.total).toBe(500);
    expect(pricing.lines).toEqual([
      { label: "Session", amount: 350 },
      { label: "Extra outfit", amount: 75 },
      { label: "Travel fee (San Jose State University)", amount: 75 },
    ]);
  });

  it("asks for review when an agreed total could exclude travel", () => {
    const pricing = resolveContractPricing(sjsuGrad, { ...none, agreedTotal: 350 });
    expect(pricing.status).toBe("review");
    expect(pricing.total).toBeNull();
    expect(pricing.status === "review" && pricing.reason).toMatch(/\$350.*travel/i);
  });

  it("uses the approved fee over a stale thread travel figure, and flags it", () => {
    const pricing = resolveContractPricing(sjsuGrad, { ...none, sessionPrice: 350, travelFee: 70 });
    expect(pricing).toMatchObject({ status: "review", total: 425 });
  });

  it("charges no campus fee for an SJSU graduate shooting in San Francisco", () => {
    const pricing = resolveContractPricing({ ...sjsuGrad, location: "Palace of Fine Arts" }, { ...none, sessionPrice: 350 });
    expect(pricing).toMatchObject({ status: "ok", total: 350 });
  });

  it("charges no campus fee on an elopement that only mentions a university", () => {
    const pricing = resolveContractPricing(
      { sessionType: "Elopement", school: null, location: "San Francisco City Hall", message: "We met at Stanford" },
      { ...none, sessionPrice: 950 },
    );
    expect(pricing).toMatchObject({ status: "ok", total: 950 });
  });

  it("asks for review when nothing priced the session", () => {
    expect(resolveContractPricing(sjsuGrad, none)).toMatchObject({ status: "review", total: null });
  });

  it("asks for review when travel is due but no amount is verified or quoted", () => {
    const pricing = resolveContractPricing(
      { sessionType: "Couples", school: null, location: "Point Reyes", message: "" },
      { ...none, sessionPrice: 450 },
    );
    expect(pricing.status).toBe("review");
  });

  it("uses a travel fee Chris quoted for an unrouted location", () => {
    const pricing = resolveContractPricing(
      { sessionType: "Couples", school: null, location: "Point Reyes", message: "" },
      { ...none, sessionPrice: 450, travelFee: 90 },
    );
    expect(pricing).toMatchObject({ status: "ok", total: 540 });
  });
});

describe("an agreed total built on a superseded travel fee", () => {
  const oldQuote = {
    body: "My sessions start at $350, plus a $70 travel fee for SJSU, so $420 total",
    fromMe: true,
    timestamp: "2026-10-01T12:00:00Z",
  };

  it("goes to review instead of into the contract", () => {
    const pricing = resolveContractPricing({ ...sjsuGrad, messages: [oldQuote] }, { ...none, agreedTotal: 420 });
    expect(pricing.status).toBe("review");
    expect(pricing.total).toBeNull();
    expect(pricing.status === "review" && pricing.reason).toMatch(/\$420.*outdated travel fee.*\$75/);
  });

  it("is caught from the formula fee alone when the thread is not loaded", () => {
    expect(resolveContractPricing(sjsuGrad, { ...none, agreedTotal: 420 })).toMatchObject({ status: "review", total: null });
  });

  it("leaves the current all-in total and a deliberate custom price alone", () => {
    expect(resolveContractPricing({ ...sjsuGrad, messages: [oldQuote] }, { ...none, agreedTotal: 425 }))
      .toMatchObject({ status: "ok", total: 425 });
    const custom = { body: "I can do $275 given the short notice", fromMe: true, timestamp: "2026-10-02T12:00:00Z" };
    expect(resolveContractPricing({ ...sjsuGrad, messages: [custom] }, { ...none, agreedTotal: 275 }))
      .toMatchObject({ status: "ok", total: 275 });
  });
});

describe("payment total inference", () => {
  it("does not price an elopement as a graduation because it names a university", () => {
    const elopement = { session_type: "Elopement", message: "We both graduated from SJSU and want to elope at City Hall", school: null, location: null, people: 2 };
    expect(catalogSessionTotalCents(elopement)).toBe(0);
  });

  it("does not price a proposal as a graduation because it names a campus", () => {
    const proposal = { session_type: "Proposal Session", message: "Surprise proposal at the Stanford campus", school: null, location: null };
    expect(catalogSessionTotalCents(proposal)).toBe(75000);
  });

  it("charges no campus fee when an SJSU graduate shoots in San Francisco", () => {
    const grad = { session_type: "Graduation", school: "San Jose State University", location: "Legion of Honor", message: "" };
    expect(catalogSessionTotalCents(grad)).toBe(35000);
  });

  it("still charges the campus fee for an on-campus graduation named only in the message", () => {
    const grad = { session_type: "Graduation", school: null, location: null, message: "I'm graduating from SJSU in May" };
    expect(catalogSessionTotalCents(grad)).toBe(42500);
  });

  it("prices maternity and both family packages from the rate card", () => {
    expect(catalogSessionTotalCents({ session_type: "Maternity Session", message: "Due in March", school: null, location: null })).toBe(50000);
    expect(catalogSessionTotalCents({ session_type: "Family Session", message: "Us and our two kids", school: null, location: null })).toBe(35000);
    expect(catalogSessionTotalCents({ session_type: "Family Session", message: "Extended family of 12 for the holidays", school: null, location: null })).toBe(50000);
  });

  it("keeps an explicitly agreed client-specific price", () => {
    const grad = { session_type: "Graduation", school: "SJSU", location: null, message: "", payment_note: "Agreed total $400" };
    expect(inferSessionTotalCents(grad)).toBe(40000);
  });
});
