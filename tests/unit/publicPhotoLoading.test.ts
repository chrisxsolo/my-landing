import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomeHero from "@/app/components/HomeHero";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

describe("homepage photos are ready before visitors select a slide", () => {
  it("renders all slide images immediately while preloading only the first", () => {
    const slides = [1, 2, 3].map((id) => ({
      id, image_url: `/hero-${id}.jpg`, alt: "Portrait", category_slug: "grads", hero_carousel: true,
      objectPosition: "center", mobileObjectPosition: "center",
    }));
    const html = renderToStaticMarkup(createElement(HomeHero, { slides }));
    const photos = html.match(/<img\b[^>]*>/g) ?? [];
    expect(photos).toHaveLength(3);
    expect(photos.some((photo) => photo.includes('loading="lazy"'))).toBe(false);
    expect(photos.filter((photo) => photo.includes('fetchPriority="low"'))).toHaveLength(2);
    expect((html.match(/rel="preload"/g) ?? []).length).toBe(1);
  });
});
