// Renders every public pricing page (server components) and asserts that the
// prices, add-ons, minimums, turnaround, and policy language they show all come
// from the central catalog (lib/pricingCatalog.ts) — never a hardcoded literal.
//
// All expected strings are DERIVED from PRICING_CATALOG here, so this test tracks
// the catalog automatically and only fails on genuine page↔catalog drift (e.g. the
// family expedited add-on silently rendering $75 instead of the catalog's $150).
//
// The pages fetch from Supabase; we mock that data layer to return no photos, so
// the render exercises only the catalog-driven copy.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PRICING_CATALOG,
  getBookingPolicyItems,
} from "@/lib/pricingCatalog";
import { formatCurrency as fc } from "@/lib/pricing";

vi.mock("@/lib/professionalData", () => ({
  getPortfolioData: async () => ({ images: [], categories: [] }),
  getSiteSettings: async () => ({}),
}));

// Keep next/image out of the server render.
vi.mock("@/app/components/OptimizedPhoto", () => ({ default: () => null }));

async function renderPage(
  importer: () => Promise<{ default: (props?: unknown) => unknown }>,
): Promise<string> {
  const mod = await importer();
  const element = (await mod.default()) as Parameters<typeof renderToStaticMarkup>[0];
  return renderToStaticMarkup(element);
}

// Visible text only (strips tags + attributes — CSS-module class names like
// "estimatorDeposit" live in attributes and must not trip the copy checks).
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function expectAll(html: string, needles: string[]) {
  for (const needle of needles) {
    expect(html, `expected rendered page to contain ${JSON.stringify(needle)}`).toContain(needle);
  }
}

const TWO_WEEK = `${PRICING_CATALOG.standardTurnaroundDays / 7}-week`;
const POLICY = getBookingPolicyItems();

describe("pricing pages render values from the catalog, not hardcoded literals", () => {
  it("families page matches the catalog (incl. the $150 expedited add-on)", async () => {
    const f = PRICING_CATALOG.families;
    const html = await renderPage(() => import("@/app/(professional)/pricing/families/page"));

    expectAll(html, [
      fc(f.packages.standard.price), // $350
      fc(f.packages.extended.price), // $500
      `Minimum ${f.packages.standard.minimumImages}`, // Minimum 10
      `Minimum ${f.packages.extended.minimumImages}`, // Minimum 30
      f.addOns.extraLocation.displayPrice, // $125
      f.addOns.expedited.displayPrice, // $150  ← the drift the prod page got wrong ($75)
      f.addOns.extendedFamily.displayPrice, // $50-$75
      f.addOns.extra30Minutes.displayPrice, // $100 / 30 min
      TWO_WEEK,
      ...POLICY,
    ]);
    expect(visibleText(html).toLowerCase()).not.toContain("deposit");
  });

  it("graduation page matches the catalog", async () => {
    const g = PRICING_CATALOG.graduation;
    const html = await renderPage(() => import("@/app/(professional)/pricing/grads/page"));

    expectAll(html, [
      fc(g.baseHourlyRate), // $350
      fc(g.addOns.extraOutfit.price), // $75
      fc(g.addOns.secondLocation.price), // $125
      fc(g.addOns.expedited.price), // $150
      fc(g.addOns.champagne.price), // $15
      fc(g.groupRates[2]), // $300
      fc(g.groupRates[6]), // $200
      `${g.standardMinimumImages}+`, // 50+
      `${g.groupMinimumImagesPerPerson}+`, // 25+
      TWO_WEEK,
      ...POLICY,
    ]);
    expect(visibleText(html).toLowerCase()).not.toContain("deposit");
  });

  it("couples page matches the catalog", async () => {
    const c = PRICING_CATALOG.couples;
    const html = await renderPage(() => import("@/app/(professional)/pricing/couples/page"));

    expectAll(html, [
      fc(c.packages.mini.price), // $350
      fc(c.packages["1hr"].price), // $450
      fc(c.packages.signature.price), // $575
      fc(c.packages.engagement.price), // $650
      fc(c.packages.proposal.price), // $750
      `+${fc(c.addOns.extraLocation.price)}`, // +$125
      `+${fc(c.addOns.extra30Minutes.price)}`, // +$175
      `+${fc(c.addOns.expedited.price)}`, // +$150
      c.addOns.shortFormVideo.displayPrice, // $175+
      c.addOns.advancedRetouching.displayPrice, // $25 / image
      `Minimum ${c.packages.signature.minimumImages}`, // Minimum 60
      TWO_WEEK,
      ...POLICY,
    ]);
    expect(visibleText(html).toLowerCase()).not.toContain("deposit");
  });

  it("events page matches the catalog", async () => {
    const e = PRICING_CATALOG.events;
    const html = await renderPage(() => import("@/app/(professional)/pricing/events/page"));

    expectAll(html, [
      fc(e.smallEvent.hourlyRate), // $500
      fc(e.mediumEvent.hourlyRate), // $450
      fc(e.mediumEvent.exampleHours[0] * e.mediumEvent.hourlyRate), // $1,800
      fc(e.largeEvent.halfDayPrice), // $2,200
      fc(e.largeEvent.fullDayStartingPrice), // $4,000
      e.addOns.secondShooter.displayPrice, // $100-$150 / hr
      e.addOns.expedited.displayPrice, // $250-$500
      e.addOns.travel.displayPrice, // $0.75-$1.00 / mile (round trip)
      `${e.includedTravelMiles} miles`, // 20 miles
      e.smallEvent.turnaroundLabel, // 1-2 week standard turnaround
    ]);
    expect(visibleText(html).toLowerCase()).not.toContain("deposit");
  });

  it("rates overview page matches the catalog", async () => {
    const html = await renderPage(() => import("@/app/(professional)/pricing/page"));

    expectAll(html, [
      fc(PRICING_CATALOG.graduation.baseHourlyRate), // $350 / hr
      fc(PRICING_CATALOG.families.packages.standard.price), // $350
      fc(PRICING_CATALOG.couples.packages.mini.price), // $350
      `${PRICING_CATALOG.graduation.standardMinimumImages}+`, // 50+
      `${PRICING_CATALOG.couples.packages.mini.minimumImages}+`, // 25+
    ]);
    expect(visibleText(html).toLowerCase()).not.toContain("deposit");
  });
});
