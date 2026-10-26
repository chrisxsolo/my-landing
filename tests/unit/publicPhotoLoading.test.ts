import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomeHero from "@/app/components/HomeHero";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

describe("homepage photos are ready before visitors select a slide", () => {
  it("ships only the first slide in the HTML, preloaded at high priority", () => {
    const slides = [1, 2, 3].map((id) => ({
      id, image_url: `/hero-${id}.jpg`, alt: "Portrait", category_slug: "grads", hero_carousel: true,
      objectPosition: "center", mobileObjectPosition: "center",
    }));
    const html = renderToStaticMarkup(createElement(HomeHero, { slides }));
    const photos = html.match(/<img\b[^>]*>/g) ?? [];
    // The other slides mount after window load (see HomeHero), so they never
    // compete with the first photo for initial bandwidth.
    expect(photos).toHaveLength(1);
    expect(photos[0]).toContain("hero-1");
    expect(photos[0]).toContain('fetchPriority="high"');
    expect(photos.some((photo) => photo.includes('loading="lazy"'))).toBe(false);
    expect((html.match(/rel="preload"/g) ?? []).length).toBe(1);
    // Every slide still has its frame, so layout never shifts when photos arrive.
    expect((html.match(/<div[^>]*data-active=/g) ?? []).length).toBe(3);
  });
});
