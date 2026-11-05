// Business, photographer, service, and page schema share two stable @ids, so
// what used to be a different ProfessionalService on every page is now one
// entity graph. Every emitted block must parse as JSON and must not invent
// facts the site does not show (address, phone, hours, ratings).
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BUSINESS_ID, PERSON_ID, WEBSITE_ID, businessEntity, businessRef, offerEntity, personEntity, personRef,
  profileGraph, serviceEntity, siteGraph, webPageEntity, type JsonLdNode,
} from "@/lib/seo/schema";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";

const post = {
  id: 7, slug: "sample-session", title: "Sample Session", body: "A short story.",
  published_at: "2026-10-01T12:00:00Z", cover_image_url: "https://cdn.example/cover.jpg", cover_image_alt: "Cover",
  extra_image_urls: [], extra_image_alts: [], og_image_url: null, meta_description: "A sample session.", meta_keywords: null,
};

// A chainable Supabase stand-in: any query resolves to no rows.
function fakeSupabase(): unknown {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") return (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
      return () => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

vi.mock("@/lib/professionalData", () => ({
  getPortfolioData: async () => ({ images: [], categories: [] }),
  getSiteSettings: async () => ({}),
  getBlogPostBySlug: async () => post,
  getBlogPostSummaries: async () => [],
}));
vi.mock("@/lib/blog/journalServices", () => ({ getJournalServicesByPostId: async () => ({}) }));
vi.mock("@/lib/blog/journalLocations", () => ({ getJournalLocationLinksByPostId: async () => ({}) }));
vi.mock("@/lib/testimonialsData", () => ({ getContextualTestimonials: async () => [] }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServerClient: () => fakeSupabase() }));
vi.mock("@/app/components/ContentEventBeacon", () => ({ default: () => null }));
vi.mock("@/app/components/OptimizedPhoto", () => ({ default: () => null }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/components/LcpPhoto", () => ({ default: () => null }));

function jsonLdBlocks(html: string): JsonLdNode[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}
const FORBIDDEN_KEYS = ["address", "telephone", "openingHours", "openingHoursSpecification", "aggregateRating", "review", "geo", "priceRange"];
function expectNoInventedFacts(node: unknown) {
  const text = JSON.stringify(node);
  for (const key of FORBIDDEN_KEYS) expect(text, `schema must not include ${key}`).not.toContain(`"${key}"`);
}

describe("entity builders", () => {
  it("use absolute, stable ids on the same origin", () => {
    expect(BUSINESS_ID).toBe("https://www.soloxsnaps.com/#business");
    expect(PERSON_ID).toBe("https://www.soloxsnaps.com/#chris-solorzano");
    expect(businessEntity()["@id"]).toBe(BUSINESS_ID);
    expect(personEntity()["@id"]).toBe(PERSON_ID);
    expect(businessRef()).toMatchObject({ "@id": BUSINESS_ID, name: "SoloXSnaps" });
    expect(personRef()).toMatchObject({ "@id": PERSON_ID, url: "https://www.soloxsnaps.com/about" });
    expect((businessEntity().founder as JsonLdNode)["@id"]).toBe(PERSON_ID);
    expect((personEntity().worksFor as JsonLdNode)["@id"]).toBe(BUSINESS_ID);
  });

  it("never state an address, phone, hours, or ratings", () => {
    expectNoInventedFacts(siteGraph("https://cdn.example/hero.jpg"));
    expectNoInventedFacts(profileGraph("/images/about/portrait.webp"));
  });

  it("the homepage graph holds the business, person, and website once each", () => {
    const graph = siteGraph(null)["@graph"] as JsonLdNode[];
    expect(graph.map((node) => node["@id"])).toEqual([BUSINESS_ID, PERSON_ID, WEBSITE_ID]);
    expect(graph.every((node) => JSON.stringify(node).includes("@context") === false)).toBe(true);
  });

  it("services point at the business as provider and price offers from the catalog", () => {
    const service = serviceEntity({
      name: "Graduation Photography", description: "Prices", path: "/pricing/grads", serviceType: "Graduation photography",
      offers: [{ name: "Mini", price: 325 }],
    });
    expect((service.provider as JsonLdNode)["@id"]).toBe(BUSINESS_ID);
    expect(service.url).toBe("https://www.soloxsnaps.com/pricing/grads");
    expect((service.offers as JsonLdNode[])[0]).toMatchObject({ "@type": "Offer", price: 325, priceCurrency: "USD" });
    const hourly = offerEntity("/pricing/events", { name: "Hourly", price: 500, unitText: "hour" });
    expect(hourly.priceSpecification).toMatchObject({ "@type": "UnitPriceSpecification", price: 500, unitText: "hour" });
    expect(hourly.price).toBeUndefined();
  });

  it("page nodes belong to the website and its publisher", () => {
    const page = webPageEntity({ type: "ContactPage", name: "Contact", description: "Send a note", path: "/contact" });
    expect(page).toMatchObject({ "@type": "ContactPage", url: "https://www.soloxsnaps.com/contact" });
    expect((page.isPartOf as JsonLdNode)["@id"]).toBe(WEBSITE_ID);
    expect((page.publisher as JsonLdNode)["@id"]).toBe(BUSINESS_ID);
  });
});

describe("rendered pages", () => {
  it("a journal post cites the photographer and business by id and links the author", async () => {
    const { default: Page } = await import("@/app/(professional)/blog/[slug]/page");
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: post.slug }) }));
    const posting = jsonLdBlocks(html).find((node) => node["@type"] === "BlogPosting")!;
    expect(posting).toBeDefined();
    expect((posting.author as JsonLdNode)["@id"]).toBe(PERSON_ID);
    expect((posting.publisher as JsonLdNode)["@id"]).toBe(BUSINESS_ID);
    expect(posting.mainEntityOfPage).toBe("https://www.soloxsnaps.com/blog/sample-session");
    expect(posting.dateModified).toBeUndefined();
    expect(html).toMatch(/<a [^>]*rel="author"[^>]*href="\/about"|<a [^>]*href="\/about"[^>]*rel="author"/);
  });

  it("pricing pages describe one Service each with the catalog's prices", async () => {
    const expectations: [string, () => Promise<{ default: () => Promise<unknown> }>, number[]][] = [
      ["/pricing/grads", () => import("@/app/(professional)/pricing/grads/page"), [PRICING_CATALOG.graduation.packages.mini.price, PRICING_CATALOG.graduation.packages.standard.price]],
      ["/pricing/families", () => import("@/app/(professional)/pricing/families/page"), [PRICING_CATALOG.families.packages.standard.price, PRICING_CATALOG.families.packages.extended.price]],
      ["/pricing/maternity", () => import("@/app/(professional)/pricing/maternity/page"), [PRICING_CATALOG.maternity.price]],
      ["/pricing/elopements", () => import("@/app/(professional)/pricing/elopements/page"), [PRICING_CATALOG.elopement.startingPrice]],
      ["/pricing/couples", () => import("@/app/(professional)/pricing/couples/page"), Object.values(PRICING_CATALOG.couples.packages).map((pkg) => pkg.price)],
    ];
    for (const [pagePath, importer, prices] of expectations) {
      const mod = await importer();
      const html = renderToStaticMarkup((await mod.default()) as Parameters<typeof renderToStaticMarkup>[0]);
      const services = jsonLdBlocks(html).filter((node) => node["@type"] === "Service");
      expect(services, pagePath).toHaveLength(1);
      expect(services[0].url).toBe(`https://www.soloxsnaps.com${pagePath}`);
      expect((services[0].provider as JsonLdNode)["@id"]).toBe(BUSINESS_ID);
      expect((services[0].offers as JsonLdNode[]).map((offer) => offer.price)).toEqual(prices);
      expectNoInventedFacts(services[0]);
    }
  });

  it("the event page prices small events per hour", async () => {
    const mod = await import("@/app/(professional)/pricing/events/page");
    const html = renderToStaticMarkup(await mod.default());
    const service = jsonLdBlocks(html).find((node) => node["@type"] === "Service")!;
    const [hourly, halfDay] = service.offers as JsonLdNode[];
    expect(hourly.priceSpecification).toMatchObject({ price: PRICING_CATALOG.events.smallEvent.hourlyRate, unitText: "hour" });
    expect(halfDay.price).toBe(PRICING_CATALOG.events.largeEvent.halfDayPrice);
  });

  it("the About page is a ProfilePage about the photographer entity", async () => {
    const mod = await import("@/app/(professional)/about/page");
    const html = renderToStaticMarkup(await mod.default());
    const graph = jsonLdBlocks(html).find((node) => Array.isArray(node["@graph"]))!["@graph"] as JsonLdNode[];
    const profile = graph.find((node) => node["@type"] === "ProfilePage")!;
    expect((profile.mainEntity as JsonLdNode)["@id"]).toBe(PERSON_ID);
    expect(graph.find((node) => node["@id"] === PERSON_ID)).toMatchObject({ "@type": "Person", name: "Chris Solorzano" });
    expect(html).toContain("Chris Solorzano, photographer behind SoloXSnaps");
  });

  it("every emitted block on these pages parses and avoids invented facts", async () => {
    const { default: Page } = await import("@/app/(professional)/blog/[slug]/page");
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: post.slug }) }));
    const blocks = jsonLdBlocks(html);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    blocks.forEach(expectNoInventedFacts);
  });
});
