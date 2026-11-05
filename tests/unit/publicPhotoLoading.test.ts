import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomeHero from "@/app/components/HomeHero";
import HomeFeaturedWork from "@/app/components/HomeFeaturedWork";
import CouplesPosingGuideClient from "@/app/(professional)/couples-posing-guide/CouplesPosingGuideClient";
import { adjacentInspirationIndices } from "@/app/(professional)/couples-posing-guide/useInspirationPhotoWarmup";
import { addMountedSlides, slidesToMount } from "@/lib/heroSlides";
import { MAX_PAGE_PHOTOS, limitPagePhotos } from "@/lib/publicPhotoWarmup";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const imgTags = (html: string) => html.match(/<img\b[^>]*>/g) ?? [];
const eagerTags = (html: string) => imgTags(html).filter((tag) => !tag.includes('loading="lazy"'));

describe("homepage photos are ready before visitors select a slide", () => {
  it("ships only the first slide in the HTML, preloaded at high priority", () => {
    const slides = [1, 2, 3].map((id) => ({
      id, image_url: `/hero-${id}.jpg`, alt: "Portrait", category_slug: "grads", hero_carousel: true,
      objectPosition: "center", mobileObjectPosition: "center",
    }));
    const html = renderToStaticMarkup(createElement(HomeHero, { slides }));
    const photos = imgTags(html);
    // Only the next slide mounts after window load (see lib/heroSlides), so
    // nothing else competes with the first photo for initial bandwidth.
    expect(photos).toHaveLength(1);
    expect(photos[0]).toContain("hero-1");
    expect(photos[0]).toContain('fetchPriority="high"');
    expect(photos.some((photo) => photo.includes('loading="lazy"'))).toBe(false);
    // One preload per viewport class (phone / larger), each behind its media query.
    expect((html.match(/rel="preload"/g) ?? []).length).toBe(2);
    expect(html).toContain('media="(max-width: 760px)"');
    expect(html).toContain('media="(min-width: 761px)"');
    // Every slide still has its frame, so layout never shifts when photos arrive.
    expect((html.match(/<div[^>]*data-active=/g) ?? []).length).toBe(3);
  });

  it("mounts only the slide after the current one, never the whole carousel", () => {
    expect(slidesToMount(0, 5)).toEqual([0, 1]);
    expect(slidesToMount(4, 5)).toEqual([4, 0]);
    expect(slidesToMount(0, 1)).toEqual([0]);
    expect(slidesToMount(0, 0)).toEqual([]);
    // After load: first and second. Picking the last slide adds it and wraps to the first.
    const afterLoad = addMountedSlides([0], slidesToMount(0, 5));
    expect(afterLoad).toEqual([0, 1]);
    expect(addMountedSlides(afterLoad, slidesToMount(4, 5))).toEqual([0, 1, 4]);
    // Nothing new keeps the same array, so React skips the re-render.
    expect(addMountedSlides(afterLoad, slidesToMount(0, 5))).toBe(afterLoad);
  });
});

describe("homepage mosaic requests photos at their rendered width", () => {
  it("asks for half-width photos on phones for the narrow tiles", () => {
    const images = [1, 2, 3, 4, 5].map((id) => ({
      id, image_url: `/story-${id}.jpg`, alt: "Portrait", category_slug: "grads",
    }));
    const html = renderToStaticMarkup(createElement(HomeFeaturedWork, { images, featuredSessions: [] }));
    const sizes = imgTags(html).map((tag) => tag.match(/sizes="([^"]+)"/)?.[1]);
    expect(sizes).toHaveLength(5);
    expect(sizes[0]).toContain("(max-width: 760px) 100vw");
    expect(sizes[1]).toContain("(max-width: 760px) 50vw");
    // No tile asks for more than its desktop column width.
    for (const value of sizes) expect(value).not.toMatch(/,\s*100vw$/);
  });
});

describe("below-the-fold galleries load as the visitor scrolls", () => {
  const images = Array.from({ length: 20 }, (_, i) => ({
    id: `img-${i}`, image_url: `/inspo-${i}.jpg`, title: `Reference ${i}`, client_notes: null,
    creator_name: null, attribution_text: null, external_source_url: null, categories: ["Walking"],
    tags: [], related_prompt_number: null, width: 1200, height: 1500, alt_text: null, visibility: "public",
  }));

  it("renders the couples posing gallery lazily instead of eager for every tile", () => {
    const html = renderToStaticMarkup(createElement(CouplesPosingGuideClient, {
      mode: "client", isAdmin: false, prompts: [], images,
      promptCategories: [], inspirationCategories: ["Walking"],
    }));
    expect(imgTags(html)).toHaveLength(20);
    expect(eagerTags(html)).toEqual([]);
  });

  it("warms only the lightbox's neighbours, and nothing while it is closed", () => {
    expect(adjacentInspirationIndices(null, 20)).toEqual([]);
    expect(adjacentInspirationIndices(0, 20)).toEqual([1, 19]);
    expect(adjacentInspirationIndices(19, 20)).toEqual([0, 18]);
    expect(adjacentInspirationIndices(0, 2)).toEqual([1]);
    expect(adjacentInspirationIndices(0, 1)).toEqual([]);
  });

  it("prefetches only a destination's first photos, not its whole gallery", () => {
    const photos = Array.from({ length: 30 }, (_, i) => ({ src: `/p-${i}.jpg` }));
    expect(limitPagePhotos(photos)).toHaveLength(MAX_PAGE_PHOTOS);
    expect(limitPagePhotos(photos)[0].src).toBe("/p-0.jpg");
    expect(limitPagePhotos(photos.slice(0, 2))).toHaveLength(2);
  });
});
