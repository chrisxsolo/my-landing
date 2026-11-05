// A journal post preloads its cover (the largest thing on screen) and lets the
// "More from this story" gallery below the article load as the reader scrolls.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const post = {
  id: 7, slug: "sample-session", title: "Sample Session", body: "A short story.",
  published_at: "2026-10-01T12:00:00Z", cover_image_url: "/cover.jpg", cover_image_alt: "Cover",
  extra_image_urls: Array.from({ length: 12 }, (_, i) => `/extra-${i}.jpg`), extra_image_alts: [],
  og_image_url: null, meta_description: "", meta_keywords: null, category: null, sites: [],
};

vi.mock("@/lib/professionalData", () => ({ getBlogPostBySlug: async () => post }));
vi.mock("@/lib/blog/journalServices", () => ({ getJournalServicesByPostId: async () => ({}) }));
vi.mock("@/lib/blog/journalLocations", () => ({ getJournalLocationLinksByPostId: async () => ({}) }));
vi.mock("@/app/components/ContentEventBeacon", () => ({ default: () => null }));

describe("journal post photo loading", () => {
  it("preloads only the cover and lazy-loads the story gallery", async () => {
    const { default: Page } = await import("@/app/(professional)/blog/[slug]/page");
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: post.slug }) }));
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    expect(images).toHaveLength(13);
    const eager = images.filter((tag) => !tag.includes('loading="lazy"'));
    expect(eager).toHaveLength(1);
    expect(eager[0]).toContain("cover.jpg");
    expect(eager[0]).toContain('fetchPriority="high"');
    expect((html.match(/rel="preload"/g) ?? []).length).toBe(2);
    expect(html).toContain('<source media="(max-width: 760px)"');
  });
});
