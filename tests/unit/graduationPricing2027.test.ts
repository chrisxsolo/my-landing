// The Spring 2027 graduation rate card: two individual packages, a per-graduate
// group table that stops at eight, and the one rule for extra time. Also the
// other half of the change: nothing here may reprice a client who booked at
// the old rates, and no other service moves.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import {
  BOOKING_POLICY, PRICING_CATALOG, calculatePaymentScheduleCents, graduationGroupTiers,
} from "@/lib/pricingCatalog";
import {
  GROUP_MAX_PEOPLE, calculateGraduationEstimate, detectGraduationDurationMinutes, graduationSessionPrice,
  isSessionLengthAllowed, type EstimateInput,
} from "@/lib/pricing";
import { buildPricingFacts } from "@/lib/ai/businessFacts";
import { buildQuoteInputForInquiry } from "@/lib/ai/inquiryQuote";
import { authoritativeQuote, checkDraftQuote } from "@/lib/ai/quotePricing";
import { resolveContractPricing, type ExtractedPricing } from "@/lib/contractPricing";
import {
  catalogSessionTotalCents, inferPaymentTotalCents, recordedPaymentTotalCents,
} from "@/lib/paymentTotalInference";
import { resolveConfirmationPricing } from "@/lib/confirmationPricing";
import { buildInvoiceDraft } from "@/lib/invoiceDraft/build";
import { NO_FACTS, type InvoiceInquiry, type SessionFacts } from "@/lib/invoiceDraft/types";
import { buildBookingIntentParams, formatBookingIntentSummary, parseBookingIntent } from "@/lib/bookingIntent";
import { FAQS as GRAD_FAQ } from "@/app/(professional)/faq/graduation/graduationFaqData";
import { FAQS as GENERAL_FAQ } from "@/app/(professional)/faq/faqData";

vi.mock("@/lib/professionalData", () => ({
  getPortfolioData: async () => ({ images: [], categories: [] }),
  getSiteSettings: async () => ({}),
}));
vi.mock("@/app/components/OptimizedPhoto", () => ({ default: () => null }));
vi.mock("@/lib/testimonialsData", () => ({ getContextualTestimonials: async () => [] }));

const grad = PRICING_CATALOG.graduation;
const { mini, standard } = grad.packages;
const EXTRA_30 = grad.addOns.extra30Minutes.price;
const SJSU = "San Jose State University";
const SJSU_FEE = grad.travelFees.sjsu;
const NO_PRICE: ExtractedPricing = { agreedTotal: null, sessionPrice: null, addOns: [], travelFee: null, includesTravel: null };
const estimate = (overrides: Partial<EstimateInput>) => calculateGraduationEstimate({
  school: "usf", people: 1, sessionLength: "1hr", extraOutfit: false, secondLocation: false, expedited: false, champagne: false, ...overrides,
});

describe("individual packages", () => {
  it("1-3. prices the mini at $325, the hour at $425, and 90/120 minutes via the $100 extension", () => {
    expect([mini.price, mini.durationMinutes]).toEqual([325, 30]);
    expect([standard.price, standard.durationMinutes]).toEqual([425, 60]);
    expect(graduationSessionPrice(1, 30)).toBe(325);
    expect(graduationSessionPrice(1, 60)).toBe(425);
    expect(graduationSessionPrice(1, 90)).toBe(525);
    expect(graduationSessionPrice(1, 120)).toBe(625);
    // Not half the hour, not an hourly rate.
    expect(mini.price).not.toBe(standard.price / 2);
    expect(graduationSessionPrice(1, 90)).not.toBe(standard.price * 1.5);
  });

  it("4. never offers the mini to a group", () => {
    for (const people of [2, 3, 8]) {
      expect(isSessionLengthAllowed(people, "30min")).toBe(false);
      expect(estimate({ people, sessionLength: "30min" }).sessionLength).not.toBe("30min");
      // $325 is also the 3-person per-graduate rate, so that headcount is checked by label instead.
      if (people !== 3) expect(buildPricingFacts({ sessionType: "Graduation", message: "", people }).basePrices).not.toContain(mini.price);
      expect(buildPricingFacts({ sessionType: "Graduation", message: "", people }).lines.join(" ")).toContain("mini is not offered to groups");
      expect(authoritativeQuote(buildQuoteInputForInquiry({ sessionType: "Graduation", school: "USF", message: "a 30 minute mini", people }).input)?.lines[0].amount)
        .toBe(graduationSessionPrice(people));
    }
    expect(resolveContractPricing({ sessionType: "Graduation", school: "USF", location: null, message: "a 30 min mini", people: 2 }, { ...NO_PRICE, agreedTotal: 325 }))
      .toMatchObject({ status: "ok", total: 325 }); // an agreed figure still stands; only the rate card refuses it
    expect(catalogSessionTotalCents({ session_type: "Graduation", school: "USF", location: null, message: "mini", people: 2 })).toBe(70000);
  });
});

describe("group rates, per graduate", () => {
  it.each([
    [2, 350, 700], [3, 325, 975], [4, 300, 1200], [5, 275, 1375], [6, 250, 1500], [7, 250, 1750], [8, 250, 2000],
  ])("5-7. %i graduates are $%i each, $%i total", (people, rate, total) => {
    expect(grad.groupRatesPerPerson[people as keyof typeof grad.groupRatesPerPerson]).toBe(rate);
    expect(graduationSessionPrice(people)).toBe(total);
    const length = people >= grad.durationRules.groupMinimumSize ? "1.5hr" : "1hr";
    expect(estimate({ people, sessionLength: length }).sessionBase).toBe(total);
    expect(buildPricingFacts({ sessionType: "Graduation", message: "", people }).lines.join(" ")).toContain(`$${rate} per graduate, $${total} total`);
  });

  it("collapses 6-8 for display but multiplies the exact headcount", () => {
    expect(graduationGroupTiers().map((t) => t.label)).toEqual(["2 people", "3 people", "4 people", "5 people", "6-8 people"]);
    expect(graduationSessionPrice(7)).toBe(1750);
  });

  it("8. requires manual review for nine or more, never the 6-8 rate", () => {
    expect(GROUP_MAX_PEOPLE).toBe(8);
    expect(graduationSessionPrice(9)).toBeNull();
    expect(() => estimate({ people: 9, sessionLength: "2hr" })).toThrow();
    const facts = buildPricingFacts({ sessionType: "Graduation", message: "", people: 9 });
    expect(facts.verified).toBe(false);
    expect(facts.basePrices).toEqual([]);
    expect(facts.needsManualQuote).toMatch(/quoted by hand/);
    expect(checkDraftQuote("Hi Sam,\n\nFor nine of you that's $250 each, so $2,250 total", buildQuoteInputForInquiry({ sessionType: "Graduation", school: "USF", people: 9 }).input).breakdown).toBeNull();
    expect(catalogSessionTotalCents({ session_type: "Graduation", school: "USF", location: null, message: "", people: 9 })).toBe(0);
    expect(resolveContractPricing({ sessionType: "Graduation", school: "USF", location: null, message: "", people: 9 }, NO_PRICE)).toMatchObject({ status: "review" });
    const extension = readFileSync("pixieset-extension/extensionPricing.js", "utf8");
    expect(extension).toMatch(/const GROUP_MAX_PEOPLE = 8;/);
    expect(extension).not.toMatch(/GROUP_RATE_6_PLUS/);
  });

  it("9-10. keeps the 90-minute minimum included for 3-8 and adds exactly $100 per extra 30 minutes", () => {
    for (const people of [3, 5, 8]) {
      expect(estimate({ people, sessionLength: "1hr" }).sessionLength).toBe("1.5hr");
      expect(estimate({ people, sessionLength: "1.5hr" }).sessionBase).toBe(graduationSessionPrice(people));
      expect(estimate({ people, sessionLength: "2hr" }).sessionBase).toBe(graduationSessionPrice(people)! + EXTRA_30);
    }
    expect(EXTRA_30).toBe(100);
    expect(estimate({ people: 2, sessionLength: "2hr" }).sessionBase).toBe(700 + 2 * EXTRA_30);
    expect(estimate({ people: 1, sessionLength: "2hr" }).sessionBase).toBe(425 + 2 * EXTRA_30);
  });
});

describe("add-ons, travel and the retainer", () => {
  it("11. leaves every add-on and travel fee unchanged and adds each once", () => {
    expect([grad.addOns.extraOutfit.price, grad.addOns.secondLocation.price, grad.addOns.expedited.price, grad.addOns.champagne.price, EXTRA_30])
      .toEqual([75, 125, 150, 15, 100]);
    expect(grad.travelFees).toEqual({
      "sf-state": null, usf: null, "sf-other": null, "uc-berkeley": 45, csueb: 65, sjsu: 75, "santa-clara": 65, stanford: 50, other: undefined,
    });
    const loaded = estimate({ school: "sjsu", people: 1, sessionLength: "30min", extraOutfit: true, secondLocation: true, expedited: true, champagne: true });
    expect(loaded.subtotal).toBe(325 + 75 + 125 + 150 + 15 + 75);
    expect(loaded.travelFee).toBe(75);
  });

  it("12. splits the retainer and balance 50/50 in cents", () => {
    for (const total of [325, 425, 400, 500, 975, 2075, 468.5]) {
      const { retainer, remainingBalance } = calculatePaymentScheduleCents(Math.round(total * 100));
      expect(retainer + remainingBalance).toBe(Math.round(total * 100));
      expect(Math.abs(retainer - remainingBalance)).toBeLessThanOrEqual(1);
    }
    const e = estimate({ school: "sjsu", sessionLength: "30min" });
    expect([e.subtotal, e.deposit, e.remainingBalance]).toEqual([400, 200, 200]);
    expect(BOOKING_POLICY.retainerPercent).toBe(50);
  });
});

describe("13. every surface agrees for new, unquoted work", () => {
  const extensionSource = readFileSync("pixieset-extension/extensionPricing.js", "utf8");
  const extensionPackages = new Function(`return ${extensionSource.match(/const GRAD_PACKAGE_PRICES = ([^;]+);/)![1]}`)() as Record<string, number>;
  const extensionGroups = new Function(`return ${extensionSource.match(/const GROUP_RATES_PER_PERSON = ([^;]+);/)![1]}`)() as Record<string, number>;

  it("prices the hour and the mini identically on the estimator, AI facts, quote check, contract, payments, invoice and extension", () => {
    for (const [minutes, text, price] of [[30, "a 30 minute mini", 325], [60, "a 1 hour session", 425]] as const) {
      const length = minutes === 30 ? "30min" : "1hr";
      expect(estimate({ school: "sjsu", sessionLength: length }).sessionBase).toBe(price);
      expect(buildPricingFacts({ sessionType: "Graduation", message: text, people: 1 }).basePrices).toContain(price);
      expect(authoritativeQuote(buildQuoteInputForInquiry({ sessionType: "Graduation", school: SJSU, message: text, people: 1 }).input)?.total).toBe(price + SJSU_FEE);
      expect(resolveContractPricing({ sessionType: "Graduation", school: SJSU, location: null, message: text, people: 1 }, { ...NO_PRICE, sessionPrice: price }))
        .toMatchObject({ status: "ok", total: price + SJSU_FEE });
      expect(catalogSessionTotalCents({ session_type: "Graduation", school: SJSU, location: null, message: text, people: 1 })).toBe((price + SJSU_FEE) * 100);
      const invoice = buildInvoiceDraft({ id: 1, name: "Test Grad", email: "grad@example.com", school: "SJSU", location: null, people: "1", session_type: "Graduation", message: text, date_in_mind: null }, NO_FACTS);
      expect(invoice.pricing.totalCents).toBe((price + SJSU_FEE) * 100);
    }
    expect(extensionPackages).toEqual({ mini: 325, standard: 425 });
    expect(extensionGroups).toEqual({ ...grad.groupRatesPerPerson });
  });

  it("passes the mini through the booking intent to the contact form intact", () => {
    const e = estimate({ school: "sjsu", sessionLength: "30min", champagne: true });
    const params = buildBookingIntentParams({
      sourcePage: "grad-estimator", sessionType: "Graduation Portrait", school: "San Jose State", headcount: 1,
      duration: "30 minutes", addOns: ["Champagne"], estimatedTotal: e.subtotal, travelPending: false,
    });
    const intent = parseBookingIntent(new URLSearchParams(params.toString()));
    expect(intent).toMatchObject({ headcount: 1, duration: "30 minutes", addOns: ["Champagne"], estimatedTotal: 415 });
    expect(formatBookingIntentSummary(intent)).toContain("Session length: 30 minutes");
    expect(formatBookingIntentSummary(intent)).toContain("Estimated total: $415");
    expect(detectGraduationDurationMinutes("Session length: 30 minutes")).toBe(30);
  });
});

describe("existing commitments keep their price", () => {
  const sjsuGrad = { sessionType: "Graduation", school: SJSU, location: null, message: "" };
  const inquiry = { session_type: "Graduation", school: SJSU, location: null, message: "1 hour session", people: 1 };

  it("14. an explicitly agreed legacy amount wins on the contract, the invoice, the confirmation and the balance", () => {
    // Quoted at the old $350 hour plus $75 travel.
    expect(resolveContractPricing(sjsuGrad, { ...NO_PRICE, agreedTotal: 425, includesTravel: true })).toMatchObject({ status: "ok", total: 425 });
    const facts: SessionFacts = { ...NO_FACTS, source: "email", confidence: "high", location: "SJSU campus", total_fee: 425, total_kind: "agreed_total", includes_travel: true };
    const legacyInquiry: InvoiceInquiry = { id: 7, name: "Legacy Grad", email: "legacy@example.com", school: "SJSU", location: null, people: "1", session_type: "Graduation", message: "", date_in_mind: null };
    const invoice = buildInvoiceDraft(legacyInquiry, facts);
    expect(invoice.status).toBe("ready");
    expect(invoice.pricing).toMatchObject({ agreedTotalCents: 42500, totalCents: 42500 });
    const confirmation = resolveConfirmationPricing({ inquiry, threadTotal: "425", recordedAmount: "212.50" });
    expect([confirmation.sessionTotal, confirmation.balanceDue, confirmation.totalSource]).toEqual(["$425", "$212.50", "thread"]);
    expect(inferPaymentTotalCents([{ payment_type: "deposit_1", amount_cents: 17500, status: "active" }], inquiry)).toBe(35000);
    expect(inferPaymentTotalCents([], { ...inquiry, payment_note: "Agreed total $425" })).toBe(42500);
  });

  it("15. never persists a rate-card figure for a record with no agreed total", () => {
    expect(recordedPaymentTotalCents([], inquiry)).toBe(0);
    expect(inferPaymentTotalCents([], inquiry)).toBe((425 + SJSU_FEE) * 100);
    expect(resolveConfirmationPricing({ inquiry }).totalSource).toBe("catalog");
    expect(resolveConfirmationPricing({ inquiry: { ...inquiry, message: "" } }).sessionTotal).toBe("");
  });

  it("15. does not mutate the catalog while pricing", () => {
    const before = JSON.stringify(PRICING_CATALOG);
    estimate({ people: 8, sessionLength: "2hr", extraOutfit: true });
    buildPricingFacts({ sessionType: "Graduation", message: "", people: 4 });
    graduationGroupTiers();
    expect(JSON.stringify(PRICING_CATALOG)).toBe(before);
  });
});

describe("16. everything else is unchanged", () => {
  it("keeps the other services and the booking policy exactly where they were", () => {
    expect(JSON.parse(JSON.stringify({ ...PRICING_CATALOG, graduation: undefined }))).toEqual({
      standardTurnaroundDays: 14,
      couples: {
        packages: {
          mini: { label: "30-Min Mini Session", price: 350, durationMinutes: 30, durationLabel: "30 minute session", minimumImages: 25 },
          "1hr": { label: "1-Hour Session", price: 450, durationMinutes: 60, durationLabel: "1 hour session", minimumImages: 40 },
          signature: { label: "Signature Session", price: 575, durationMinutes: 90, durationLabel: "75-90 minute session", minimumImages: 60 },
          engagement: { label: "Engagement Session", price: 650, durationMinutes: 90, durationLabel: "90 minute session", minimumImages: 70 },
          proposal: { label: "Proposal Session", price: 750, durationLabel: "Proposal coverage and portraits", minimumImages: 50 },
        },
        addOns: {
          extraLocation: { label: "Additional nearby location", shortLabel: "Extra location", price: 125 },
          extraOutfit: { label: "Additional outfit", shortLabel: "Extra outfit", price: 75 },
          extra30Minutes: { label: "Extra 30 minutes", shortLabel: "Extra 30 minutes", price: 175 },
          proofingGallery: { label: "Client proofing gallery", shortLabel: "Proofing gallery", price: 75 },
          rushPreview: { label: "Rush preview - 5 edited images within 48 hours", shortLabel: "Rush preview", price: 75 },
          expedited: { label: "Expedited full gallery delivery within 72 hours", shortLabel: "72-hour delivery", price: 150 },
          advancedRetouching: { label: "Advanced retouching", displayPrice: "$25 / image" },
        },
        travelFees: { sf: null, berkeley: 45, "santa-clara": 65 },
      },
      elopement: {
        startingPrice: 950, durationMinutes: 120, durationLabel: "2 hours of coverage", minimumImages: 60,
        addOns: {
          extraLocation: { label: "Additional nearby location", shortLabel: "Extra location", price: 125 },
          extraCoverage: { label: "Additional photography coverage", displayPrice: "Custom quote" },
          travel: { label: "Travel outside the standard service area", displayPrice: "$0.70 / mile (round trip) + tolls" },
        },
      },
      maternity: {
        label: "Maternity Session", price: 500, durationMinutes: 60, minimumImages: 30, locations: 1, outfits: 1,
        addOns: {
          extraOutfit: { label: "Additional outfit", shortLabel: "Extra outfit", price: 75 },
          secondLocation: { label: "Second nearby location", shortLabel: "Second location", price: 125 },
          expedited: { label: "72-hour full gallery delivery", shortLabel: "72-hour delivery", price: 150 },
          travel: { label: "Travel outside San Francisco", displayPrice: "$0.70 / mile (round trip) + tolls" },
        },
      },
      families: {
        packages: {
          standard: { label: "Family Session", price: 350, durationMinutes: 30, minimumImages: 10 },
          extended: { label: "Extended Family Session", price: 500, durationMinutes: 60, minimumImages: 30 },
        },
        addOns: {
          extraLocation: { label: "Additional nearby location", price: 125, displayPrice: "$125" },
          expedited: { label: "72-hour full gallery delivery", price: 150, displayPrice: "$150" },
          extendedFamily: { label: "Extended family members", priceMin: 50, priceMax: 75, displayPrice: "$50-$75" },
          extra30Minutes: { label: "Additional time", price: 100, displayPrice: "$100 / 30 min" },
        },
      },
      events: {
        smallEvent: { hourlyRate: 500, minimumHours: 2, minimumImages: 30, turnaroundLabel: "1-2 week standard turnaround" },
        mediumEvent: { hourlyRate: 450, minimumHours: 4, exampleHours: [4, 5, 6] },
        largeEvent: { halfDayHours: 5, halfDayPrice: 2200, fullDayStartingPrice: 4000 },
        addOns: {
          secondShooter: { label: "Second shooter", displayPrice: "$100-$150 / hr" },
          expedited: { label: "48-72 hour expedited delivery", displayPrice: "$250-$500" },
          travel: { label: "Travel outside San Francisco", displayPrice: "$0.70 / mile (round trip) + tolls" },
        },
      },
    });
    expect(BOOKING_POLICY.retainerPercent).toBe(50);
    expect(BOOKING_POLICY.retainerRefundability).toBe("non-refundable");
    expect(BOOKING_POLICY.remainingBalanceDeadline).toBe("on or before the session date");
    expect([grad.standardMinimumImages, grad.groupMinimumImagesPerPerson]).toEqual([50, 25]);
    expect([grad.durationRules.groupMinimumSize, grad.durationRules.groupMinimumMinutes]).toEqual([3, 90]);
  });
});

describe("17. public copy and metadata describe packages, not an hourly rate", () => {
  const strip = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  it("on the graduation pricing page and its metadata", async () => {
    const mod = await import("@/app/(professional)/pricing/grads/page");
    const html = strip(renderToStaticMarkup((await mod.default()) as Parameters<typeof renderToStaticMarkup>[0]));
    expect(html).toContain("$325");
    expect(html).toContain("$425");
    expect(html).toContain("30-min mini");
    expect(html).not.toMatch(/per hour|\/\s?hr\b|hourly/i);
    const description = String(mod.metadata.description);
    expect(description).toMatch(/30-minute mini from \$325/);
    expect(description).toMatch(/1-hour session at \$425/);
    expect(description).toMatch(/\$250 per graduate for groups of 6-8/);
    expect(description).not.toMatch(/^.*from \$250\b/);
    expect(description).not.toMatch(/hour(ly)? rate|\/hr/);
  });

  it("in the FAQs and the AI facts", () => {
    const faq = [...GRAD_FAQ, ...GENERAL_FAQ].flatMap((g) => g.items.map((i) => i.a)).join("\n");
    expect(faq).toContain("$325 for 30 minutes");
    expect(faq).toContain("$425 for 60 minutes");
    expect(faq).toContain("$250 each for 6-8 people");
    expect(faq).not.toMatch(/\$\d+ (per|an) hour|\/hr/);
    const facts = buildPricingFacts({ sessionType: "Graduation", message: "", people: 1 }).lines.join(" ");
    expect(facts).toMatch(/Graduation Mini is \$325 for 30 minutes/);
    expect(facts).toMatch(/Graduation Session is \$425 for 60 minutes/);
    expect(facts.replace(/Do NOT say[^.]*\./g, "")).not.toMatch(/per hour|\/hour/);
  });
});
