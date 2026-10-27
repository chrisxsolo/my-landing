// One price per item, on every surface that states it.
//
// The rate card is code (lib/pricingCatalog.ts). This suite walks each priced
// item and checks that the public estimator, Draft AI's facts and quote check,
// the FAQ copy, the contract generator, payment totals and the Pixieset
// extension all land on the same number, so a change to one surface alone
// fails here instead of in a client's inbox.
//
// Payment totals (lib/paymentTotalInference.ts) price graduations and couples
// sessions only; maternity and family return 0 there and are not asserted.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRICING_CATALOG, addOnPriceValues, calculatePaymentSchedule } from "@/lib/pricingCatalog";
import {
  calculateCouplesEstimate, calculateGraduationEstimate, graduationSessionPrice, type EstimateInput,
} from "@/lib/pricing";
import { verifiedTravelFee } from "@/lib/travelFee";
import { catalogSessionTotalCents } from "@/lib/paymentTotalInference";
import { resolveContractPricing, type ExtractedPricing } from "@/lib/contractPricing";
import { buildPricingFacts, buildTravelFact } from "@/lib/ai/businessFacts";
import { buildQuoteInputForInquiry } from "@/lib/ai/inquiryQuote";
import { authoritativeQuote } from "@/lib/ai/quotePricing";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { validateEmailDraft } from "@/lib/ai/validateEmailDraft";
import { generateDraft } from "@/lib/ai/emailOperations";
import { FAQS as GRAD_FAQ } from "@/app/(professional)/faq/graduation/graduationFaqData";
import { FAQS as FAMILY_FAQ } from "@/app/(professional)/family-guide/faq/familyFaqData";
import { FAQS as COUPLES_FAQ } from "@/app/(professional)/couples-guide/faq/couplesFaqData";
import { FAQS as GENERAL_FAQ } from "@/app/(professional)/faq/faqData";
import { AVAILABILITY, NOW, fakeCaller, inquiry } from "./ai/fixtures";

const grad = PRICING_CATALOG.graduation;
const couples = PRICING_CATALOG.couples;
const SJSU = "San Jose State University";
const SJSU_FEE = verifiedTravelFee("sjsu");
const NO_PRICE: ExtractedPricing = { agreedTotal: null, sessionPrice: null, addOns: [], travelFee: null, includesTravel: null };
const sjsuBooking = { sessionType: "Graduation", school: SJSU, location: null, message: "" };

const faqText = (faqs: typeof GRAD_FAQ) => faqs.flatMap((g) => g.items.map((i) => i.a)).join("\n");

const BASE_ESTIMATE: EstimateInput = {
  school: "sjsu", people: 1, sessionLength: "1hr",
  extraOutfit: false, secondLocation: false, expedited: false, champagne: false,
};

/** The extension's hand-mirrored constants, read as the values the file declares. */
function pixiesetConstants() {
  const source = readFileSync("pixieset-extension/content.js", "utf8");
  const literal = (name: string) => {
    const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
    if (!match) throw new Error(`${name} is not declared in content.js`);
    return new Function(`return ${match[1]}`)() as Record<string, number> & number;
  };
  return {
    gradHourly: Number(literal("GRAD_HOURLY_RATE")),
    groupRates: literal("GROUP_RATES") as Record<string, number>,
    groupRate6Plus: Number(literal("GROUP_RATE_6_PLUS")),
    travelFees: literal("TRAVEL_FEES") as Record<string, number>,
    flatRates: literal("SERVICE_FLAT_RATES") as Record<string, number>,
  };
}
const pixieset = pixiesetConstants();

describe("graduation sessions", () => {
  it.each([1, 2, 3, 4, 5, 6])("price %i graduate(s) the same everywhere", (people) => {
    const session = graduationSessionPrice(people);
    const estimate = calculateGraduationEstimate({ ...BASE_ESTIMATE, people, sessionLength: people >= 3 ? "1.5hr" : "1hr" });
    expect(estimate.sessionBase).toBe(session);

    const facts = buildPricingFacts({ sessionType: "Graduation", message: "", people });
    expect(facts.basePrices).toContain(session);
    const quote = authoritativeQuote(buildQuoteInputForInquiry({ sessionType: "Graduation", school: SJSU, people }).input);
    expect(quote?.lines.map((l) => l.amount)).toEqual([session, SJSU_FEE]);

    expect(resolveContractPricing({ ...sjsuBooking, people }, { ...NO_PRICE, sessionPrice: session }))
      .toMatchObject({ status: "ok", total: session + SJSU_FEE });
    expect(catalogSessionTotalCents({ session_type: "Graduation", school: SJSU, message: "", people })).toBe((session + SJSU_FEE) * 100);

    const pixiesetSession = people <= 1 ? pixieset.gradHourly : (pixieset.groupRates[people] ?? pixieset.groupRate6Plus) * people;
    expect(pixiesetSession).toBe(session);
  });

  const toggles = {
    extraOutfit: grad.addOns.extraOutfit, secondLocation: grad.addOns.secondLocation,
    expedited: grad.addOns.expedited, champagne: grad.addOns.champagne,
  } as const;

  it.each(Object.keys(toggles) as (keyof typeof toggles)[])("add-on %s is one price on every surface", (key) => {
    const addOn = toggles[key];
    const estimate = calculateGraduationEstimate({ ...BASE_ESTIMATE, [key]: true });
    expect(estimate.addons).toBe(addOn.price);
    expect(buildPricingFacts({ sessionType: "Graduation", message: "", people: 1 }).addOnPrices).toContain(addOn.price);
    expect(faqText(GRAD_FAQ)).toContain(`$${addOn.price}`);
    const contract = resolveContractPricing(sjsuBooking, {
      ...NO_PRICE, sessionPrice: grad.baseHourlyRate, addOns: [{ label: addOn.label, amount: addOn.price }],
    });
    expect(contract).toMatchObject({ status: "ok", total: estimate.subtotal });
  });

  it("quotes the extra 30 minutes at the catalog price", () => {
    expect(buildPricingFacts({ sessionType: "Graduation", message: "", people: 1 }).lines.join(" "))
      .toContain(`$${grad.addOns.extra30Minutes.price} for each extra 30 minutes`);
    expect(calculateGraduationEstimate({ ...BASE_ESTIMATE, people: 2, sessionLength: "1.5hr" }).sessionBase)
      .toBe(graduationSessionPrice(2) + grad.addOns.extra30Minutes.price);
  });
});

describe("SJSU travel", () => {
  it("is the approved fee on every surface", () => {
    expect(grad.travelFees.sjsu).toBe(SJSU_FEE);
    expect(calculateGraduationEstimate(BASE_ESTIMATE).travelFee).toBe(SJSU_FEE);
    expect(buildTravelFact(SJSU, null)).toContain(`$${SJSU_FEE}.`);
    expect(faqText(GRAD_FAQ)).toContain(`SJSU ($${SJSU_FEE})`);
    const contract = resolveContractPricing(sjsuBooking, { ...NO_PRICE, sessionPrice: grad.baseHourlyRate });
    expect(contract.lines.at(-1)).toEqual({ label: `Travel fee (${SJSU})`, amount: SJSU_FEE });
    expect(calculatePaymentSchedule(grad.baseHourlyRate + SJSU_FEE).retainer * 2).toBe(grad.baseHourlyRate + SJSU_FEE);
    expect(pixieset.travelFees.sjsu).toBe(SJSU_FEE);
  });

  it("keeps every campus fee the extension mirrors equal to the catalog", () => {
    for (const [key, fee] of Object.entries(pixieset.travelFees)) {
      expect(grad.travelFees[key as keyof typeof grad.travelFees] ?? 0, key).toBe(fee);
    }
  });
});

describe("couples packages", () => {
  const packages = {
    mini: { key: "mini", sessionType: "Couples", message: "a mini session" },
    "1hr": { key: "1hr", sessionType: "Couples", message: "" },
    signature: { key: "signature", sessionType: "Couples", message: "the signature package" },
    engagement: { key: "engagement", sessionType: "Engagement", message: "" },
    proposal: { key: "proposal", sessionType: "Proposal", message: "" },
  } as const;

  it.each(Object.values(packages))("$key is one price on every surface", ({ key, sessionType, message }) => {
    const price = couples.packages[key].price;
    expect(calculateCouplesEstimate({
      packageKey: key, location: "sf", extraLocation: false, extraOutfit: false,
      extra30Min: false, proofingGallery: false, rushPreview: false, expedited: false,
    }).sessionBase).toBe(price);
    expect(buildPricingFacts({ sessionType, message }).basePrices).toContain(price);
    expect(catalogSessionTotalCents({ session_type: sessionType, message, school: null, location: null })).toBe(price * 100);
    expect(resolveContractPricing(
      { sessionType, school: null, location: "Golden Gate Park", message }, { ...NO_PRICE, sessionPrice: price },
    )).toMatchObject({ status: "ok", total: price });
  });

  it("matches the extension's flat rates", () => {
    expect(pixieset.flatRates.couples).toBe(couples.packages["1hr"].price);
    expect(pixieset.flatRates.engagement).toBe(couples.packages.engagement.price);
    expect(pixieset.flatRates.proposal).toBe(couples.packages.proposal.price);
  });

  it("states the add-on prices the FAQ names from the catalog", () => {
    const text = faqText(COUPLES_FAQ);
    expect(text).toContain(`($${couples.addOns.extraOutfit.price})`);
    expect(text).toContain(`($${couples.addOns.extraLocation.price})`);
    const facts = buildPricingFacts({ sessionType: "Couples", message: "" });
    for (const addOn of [couples.addOns.extraOutfit, couples.addOns.extraLocation, couples.addOns.extra30Minutes, couples.addOns.expedited]) {
      expect(facts.addOnPrices).toContain(addOn.price);
    }
  });
});

describe("family and maternity packages", () => {
  const families = PRICING_CATALOG.families;
  const maternity = PRICING_CATALOG.maternity;

  it("price the two family sessions the same everywhere", () => {
    const facts = buildPricingFacts({ sessionType: "Family Session", message: "" });
    expect(facts.basePrices).toEqual([families.packages.standard.price, families.packages.extended.price]);
    expect(pixieset.flatRates.family).toBe(families.packages.standard.price);
    expect(pixieset.flatRates["extended-family"]).toBe(families.packages.extended.price);
    expect(faqText(GENERAL_FAQ)).toContain(`family sessions at $${families.packages.standard.price}`);
    expect(resolveContractPricing(
      { sessionType: "Family Session", school: null, location: "Golden Gate Park", message: "" },
      { ...NO_PRICE, sessionPrice: families.packages.standard.price },
    )).toMatchObject({ status: "ok", total: families.packages.standard.price });
  });

  it("derive the family add-on text and the AI's list from the same numbers", () => {
    const facts = buildPricingFacts({ sessionType: "Family Session", message: "" });
    expect(facts.addOnPrices).toEqual(addOnPriceValues(families.addOns));
    expect(facts.lines.join(" ")).toContain(families.addOns.extendedFamily.displayPrice);
    expect(faqText(FAMILY_FAQ)).toContain(families.addOns.extendedFamily.displayPrice);
    expect(faqText(FAMILY_FAQ)).toContain(families.addOns.expedited.displayPrice);
    expect(families.addOns.expedited.displayPrice).toBe(`$${families.addOns.expedited.price}`);
  });

  it("price maternity as one package everywhere", () => {
    expect(buildPricingFacts({ sessionType: "Maternity Session", message: "" }).basePrices).toEqual([maternity.price]);
    expect(pixieset.flatRates.maternity).toBe(maternity.price);
    expect(faqText(GENERAL_FAQ)).toContain(`maternity sessions are $${maternity.price}`);
    expect(resolveContractPricing(
      { sessionType: "Maternity Session", school: null, location: "Golden Gate Park", message: "" },
      { ...NO_PRICE, sessionPrice: maternity.price },
    )).toMatchObject({ status: "ok", total: maternity.price });
    expect(pixieset.flatRates.elopement).toBe(PRICING_CATALOG.elopement.startingPrice);
  });
});

describe("Draft AI against the rate card", () => {
  const generate = (reply: string, overrides: Parameters<typeof inquiry>[0]) => generateDraft({
    inquiry: inquiry(overrides), messages: [], availability: AVAILABILITY,
    threadLoaded: true, now: NOW, rules: [], threadText: null,
  }, fakeCaller(reply));

  it("corrects a draft quoting $70 SJSU travel to the approved $75 server-side", async () => {
    const result = await generate(
      "Hi Sarah,\n\nMy sessions start at $350, plus a $70 travel fee for SJSU, so $420 total",
      { school: SJSU, people: 1 },
    );
    expect(result.draft).toContain(`$${SJSU_FEE} travel fee for SJSU, so $${grad.baseHourlyRate + SJSU_FEE} total`);
    expect(result.pricing.corrections.map((c) => c.expected)).toEqual([SJSU_FEE, grad.baseHourlyRate + SJSU_FEE]);
    expect(result.validation.factsVerified).toBe(true);
  });

  it("flags a custom quote for an unrouted location instead of inventing a fee", async () => {
    const draft = "Hi Sarah,\n\nA couples session is $450, plus a $90 travel fee for Point Reyes, so $540 total";
    const result = await generate(draft, { sessionType: "Couples", school: null, location: "Point Reyes" });
    expect(result.draft).toBe(draft);
    expect(result.pricing.corrections).toEqual([]);
    expect(result.validation.issues.map((i) => i.type)).toContain("pricing_mismatch");
    expect(result.context.warnings.map((w) => w.code)).toContain("travel_unverified");
    expect(result.validation.factsVerified).toBe(false);
  });

  it("asks for confirmation when there is no pricing record for the session", () => {
    const context = buildEmailContext({
      inquiry: inquiry({ sessionType: "Headshots", message: "I need a headshot for LinkedIn" }),
      messages: [], availability: AVAILABILITY, threadLoaded: true, now: NOW,
    });
    expect(context.pricing.verified).toBe(false);
    expect(context.pricing.needsManualQuote).toMatch(/do not quote a price/i);
    expect(context.warnings).toContainEqual(expect.objectContaining({ code: "pricing_unverified", severity: "high" }));
    const result = validateEmailDraft("Hi Sarah,\n\nHeadshots are $200", context);
    expect(result.issues.map((i) => i.type)).toContain("unsupported_price");
    expect(result.needsReview).toBe(true);
    expect(authoritativeQuote(buildQuoteInputForInquiry({ sessionType: "Headshots", message: "" }).input)).toBeNull();
    expect(resolveContractPricing({ sessionType: "Headshots", school: null, location: null, message: "" }, NO_PRICE))
      .toMatchObject({ status: "review", reason: expect.stringMatching(/No agreed price/) });
  });
});
