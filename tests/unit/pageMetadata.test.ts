// Every public page's share and search metadata comes from one builder, so a
// page that sets its own Open Graph block still carries an absolute og:url, a
// share image, and a large Twitter card. Next merges metadata shallowly: the
// root layout's defaults never reach a page that defines `openGraph` itself,
// which is how 57 of 85 pages shipped without a share image.
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_SOCIAL_IMAGE, SITE_URL, absoluteUrl, buildPageMetadata } from "@/lib/seo/siteMetadata";
import { buildSchoolMetadata } from "@/app/components/SchoolLandingTemplate";
import { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";
import { data as usf } from "@/app/(professional)/grads/usf/data";
import { data as csueb } from "@/app/(professional)/grads/csueb/data";

vi.mock("@/lib/professionalData", () => ({
  getPortfolioData: async () => ({ images: [], categories: [] }),
  getSiteSettings: async () => ({}),
  getBlogPostSummaries: async () => [],
  getBlogPostBySlug: async () => ({
    id: 1, slug: "sample-session", title: "Sample Session", body: "Body text.",
    published_at: "2026-10-01T12:00:00Z", cover_image_url: "https://cdn.example/cover.jpg", cover_image_alt: "Cover photo",
    extra_image_urls: [], extra_image_alts: [], og_image_url: null, meta_description: "A sample graduation session at the Palace of Fine Arts in San Francisco.", meta_keywords: null,
  }),
}));
vi.mock("@/lib/testimonialsData", () => ({
  getContextualTestimonials: async () => [], getFeaturedTestimonials: async () => [],
  getFeaturedTestimonialsForCategory: async () => [], pickBalancedTestimonials: () => [],
}));
vi.mock("@/lib/blog/journalServices", () => ({ getJournalServicesByPostId: async () => ({}) }));
vi.mock("@/lib/blog/journalLocations", () => ({ getJournalLocationLinksByPostId: async () => ({}) }));
vi.mock("@/lib/pagePhotos/publicPages", () => ({
  getSchoolPagePhotos: async () => ({ hero: null, gallery: [], matchedCount: 0 }),
  getPortfolioSchoolsByUrl: async () => ({}),
}));

type OpenGraph = NonNullable<Metadata["openGraph"]> & { url?: string | URL; images?: unknown; type?: string };
type Twitter = NonNullable<Metadata["twitter"]> & { card?: string; images?: unknown };
const og = (meta: Metadata) => meta.openGraph as OpenGraph;
const tw = (meta: Metadata) => meta.twitter as Twitter;

function expectComplete(meta: Metadata, pagePath: string) {
  expect(meta.alternates?.canonical).toBe(pagePath);
  expect(og(meta).url).toBe(`${SITE_URL}${pagePath === "/" ? "" : pagePath}`);
  expect(og(meta).siteName).toBe("SoloXSnaps");
  expect(tw(meta).card).toBe("summary_large_image");
  expect(String(meta.title).length).toBeGreaterThan(0);
  expect(String(meta.description).length).toBeGreaterThan(50);
}

describe("buildPageMetadata", () => {
  it("fills the canonical, absolute og:url, brand image and large card from a path", () => {
    const meta = buildPageMetadata({ title: "Rates", description: "Prices for every session type on the site, from graduation minis to elopements.", path: "/pricing" });
    expectComplete(meta, "/pricing");
    expect(og(meta).title).toBe("Rates | SoloXSnaps");
    expect(og(meta).images).toEqual([DEFAULT_SOCIAL_IMAGE]);
    expect(tw(meta).images).toEqual([DEFAULT_SOCIAL_IMAGE.url]);
    expect(DEFAULT_SOCIAL_IMAGE.url).toMatch(/^https:\/\/www\.soloxsnaps\.com\//);
    expect(DEFAULT_SOCIAL_IMAGE).toMatchObject({ width: 1200, height: 630 });
  });

  it("uses a page's own image, made absolute, and keeps article fields", () => {
    const meta = buildPageMetadata({
      title: "Post", description: "A journal entry about a graduation session at the Palace of Fine Arts.",
      path: "/blog/post", type: "article", publishedTime: "2026-10-01T12:00:00Z",
      image: { url: "/images/post.jpg", alt: "Graduate" },
    });
    expect(og(meta).images).toEqual([{ url: `${SITE_URL}/images/post.jpg`, alt: "Graduate" }]);
    expect(og(meta).type).toBe("article");
    expect((og(meta) as { publishedTime?: string }).publishedTime).toBe("2026-10-01T12:00:00Z");
    expect(absoluteUrl("https://cdn.example/x.jpg")).toBe("https://cdn.example/x.jpg");
  });

  it("leaves images out for routes that ship their own opengraph-image file", () => {
    const meta = buildPageMetadata({ title: "Contact", description: "Send a booking note with your date, location, and session type.", path: "/contact", image: null });
    expect(og(meta).images).toBeUndefined();
    expect(tw(meta).images).toBeUndefined();
    expect(tw(meta).card).toBe("summary_large_image");
  });
});

describe("root layout fallback", () => {
  it("declares the brand image and large card for pages without their own block", () => {
    const source = readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(source).toContain("images: [DEFAULT_SOCIAL_IMAGE]");
    expect(source).toMatch(/twitter: \{ card: "summary_large_image"/);
    expect(source).toContain('metadataBase: new URL("https://www.soloxsnaps.com")');
  });

  it("opens the Supabase image connection early for the LCP photo", () => {
    const source = readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(source).toContain('const SUPABASE_ORIGIN = "https://dmtslzwglpezympptqls.supabase.co"');
    expect(source).toContain("preconnect(SUPABASE_ORIGIN)");
  });
});

describe("campus pages", () => {
  it("a school page carries the campus hero when one exists, else the brand image", () => {
    const withHero = buildSchoolMetadata(usf, { url: "https://cdn.example/usf-hero.jpg", alt: "USF graduate", width: 1600, height: 2000 });
    expectComplete(withHero, "/grads/usf");
    expect(og(withHero).images).toEqual([{ url: "https://cdn.example/usf-hero.jpg", alt: "USF graduate", width: 1600, height: 2000 }]);
    const fallback = buildSchoolMetadata(csueb);
    expectComplete(fallback, "/grads/csueb");
    expect(og(fallback).images).toEqual([DEFAULT_SOCIAL_IMAGE]);
  });

  it("a spots page is complete whether it has a long-form guide or the compact list", () => {
    expectComplete(buildSpotsMetadata(usf), "/grads/usf/spots");
    expectComplete(buildSpotsMetadata(csueb), "/grads/csueb/spots");
    expect(og(buildSpotsMetadata(csueb)).images).toEqual([DEFAULT_SOCIAL_IMAGE]);
  });
});

describe("static public pages", () => {
  const pages = [
    ["/pricing", () => import("@/app/(professional)/pricing/page")],
    ["/pricing/grads", () => import("@/app/(professional)/pricing/grads/page")],
    ["/pricing/events", () => import("@/app/(professional)/pricing/events/page")],
    ["/blog", () => import("@/app/(professional)/blog/page")],
    ["/privacy", () => import("@/app/(professional)/privacy/page")],
    ["/terms", () => import("@/app/(professional)/terms/page")],
    ["/grad-guide/posing", () => import("@/app/(professional)/grad-guide/posing/page")],
    ["/faq", () => import("@/app/(professional)/faq/page")],
  ] as const;

  it.each(pages)("%s has a complete metadata set", async (pagePath, importer) => {
    const mod = (await importer()) as { metadata: Metadata };
    expectComplete(mod.metadata, pagePath);
    expect(og(mod.metadata).images).toEqual([DEFAULT_SOCIAL_IMAGE]);
  });

  it("the homepage keeps its own share image and title", () => {
    // The homepage loads a Google font at import time, so read its source.
    const source = readFileSync(path.join(process.cwd(), "app/(professional)/page.tsx"), "utf8");
    expect(source).toContain("export const metadata: Metadata = buildPageMetadata({");
    expect(source).toContain('path: "/"');
    expect(source).toContain("socialTitle: SOCIAL_TITLE");
    expect(source).toContain("image: { url: SOCIAL_IMAGE, width: 1200, height: 630");
  });

  it("commercial titles lead with the service and place", async () => {
    const { metadata: pricing } = await import("@/app/(professional)/pricing/page");
    const { metadata: events } = await import("@/app/(professional)/pricing/events/page");
    const { metadata: blog } = await import("@/app/(professional)/blog/page");
    expect(pricing.title).toBe("Bay Area Photography Pricing & Session Rates");
    expect(events.title).toBe("Bay Area Event Photography Pricing");
    expect(String(events.description)).toMatch(/\$500\/hour/);
    expect(blog.title).not.toBe("Journal");
  });
});

describe("journal posts", () => {
  it("use the cover as the share image with an absolute og:url", async () => {
    const { generateMetadata } = await import("@/app/(professional)/blog/[slug]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "sample-session" }) });
    expectComplete(meta, "/blog/sample-session");
    expect(og(meta).type).toBe("article");
    expect(og(meta).images).toEqual([{ url: "https://cdn.example/cover.jpg", alt: "Cover photo" }]);
    expect(tw(meta).images).toEqual(["https://cdn.example/cover.jpg"]);
  });
});
