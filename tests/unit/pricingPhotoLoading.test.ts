import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getPricingPhotoManifest } from "@/lib/pricingPhotos";

const { images } = vi.hoisted(() => ({
  images: ["grads", "families", "couples", "events", "elopements"].flatMap((category_slug) =>
    [0, 1, 2].map((id) => ({
      id, category_slug, image_url: `/${category_slug}-${id}.jpg`, title: "Portrait", alt: "Portrait",
    })),
  ),
}));

vi.mock("@/lib/professionalData", () => ({
  getPortfolioData: async () => ({ images, categories: [] }),
  getSiteSettings: async () => ({}),
}));
vi.mock("@/lib/testimonialsData", () => ({ getContextualTestimonials: async () => [] }));

const pages = [
  ["rates overview", () => import("@/app/(professional)/pricing/page")],
  ["family rates", () => import("@/app/(professional)/pricing/families/page")],
  ["graduation rates", () => import("@/app/(professional)/pricing/grads/page")],
  ["couples rates", () => import("@/app/(professional)/pricing/couples/page")],
  ["event rates", () => import("@/app/(professional)/pricing/events/page")],
  ["elopement rates", () => import("@/app/(professional)/pricing/elopements/page")],
] as const;

describe("rates photos load before visitors scroll to them", () => {
  it.each(pages)("%s does not defer its photos until scrolling", async (_, importer) => {
    const page = await importer();
    const html = renderToStaticMarkup(await page.default());
    const photos = html.match(/<img\b[^>]*>/g) ?? [];
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.filter((photo) => photo.includes('loading="lazy"'))).toEqual([]);
  });

  it("shared photos defer by default, so rates pages opt in explicitly", () => {
    const html = renderToStaticMarkup(createElement(OptimizedPhoto, {
      src: "/other-photo.jpg", alt: "Portrait", sizes: "100vw",
    }));
    expect(html).toContain('loading="lazy"');
  });
});

describe("rates photo warmup follows the displayed photo selection", () => {
  it("warms the distinct family hero and both package photos", () => {
    const manifest = getPricingPhotoManifest(images, {});
    expect(manifest["/pricing/families"].map((photo) => photo.src)).toEqual([
      "/families-0.jpg", "/families-1.jpg", "/families-2.jpg",
    ]);
  });

  it("warms elopement photos only from the elopement category", () => {
    const manifest = getPricingPhotoManifest(images, {});
    expect(manifest["/pricing/elopements"].map((photo) => photo.src)).toEqual([
      "/elopements-0.jpg", "/elopements-1.jpg",
    ]);
    // A library with no elopement photos warms nothing rather than borrowing a
    // graduation portrait for the elopement page.
    const grads = images.filter((image) => image.category_slug === "grads");
    expect(getPricingPhotoManifest(grads, {})["/pricing/elopements"]).toEqual([]);
  });

  it("uses admin overrides rather than warming obsolete portfolio photos", () => {
    const manifest = getPricingPhotoManifest(images, {
      pricing_card_families_image: "/custom-card.jpg",
      pricing_family_session_image: "/custom-family.jpg",
      pricing_family_extended_image: "/custom-extended.jpg",
      pricing_grad_group_image: "/custom-group.jpg",
      pricing_couples_standard_image: "/custom-couples.jpg",
    });
    expect(manifest["/pricing"].map((photo) => photo.src)).toContain("/custom-card.jpg");
    expect(manifest["/pricing/families"].map((photo) => photo.src)).toEqual([
      "/families-0.jpg", "/custom-family.jpg", "/custom-extended.jpg",
    ]);
    expect(manifest["/pricing/grads"].map((photo) => photo.src)).toContain("/custom-group.jpg");
    expect(manifest["/pricing/couples"][0].src).toBe("/custom-couples.jpg");
  });

  it("does not start image requests when no photos are configured", () => {
    const manifest = getPricingPhotoManifest([], {});
    expect(Object.values(manifest).flat()).toEqual([]);
  });
});
