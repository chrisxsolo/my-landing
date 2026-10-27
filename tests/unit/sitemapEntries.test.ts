// The sitemap weights each campus spot guide by whether its spot sections
// show photos, lists published location guides, and leaves utility pages out.
import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

const SITE = "https://www.soloxsnaps.com";
const WITH_PHOTOS = new Set(["uc-berkeley", "sjsu", "usf", "sf-state"]);

vi.mock("@/lib/professionalData", () => ({ getBlogPostSummaries: async () => [] }));
vi.mock("@/lib/blog/categoryPosts", () => ({ getJournalPostsForCategory: async () => [] }));
vi.mock("@/lib/locations/guideListings", () => ({ indexableDbGuidePaths: async () => [] }));
vi.mock("@/lib/pagePhotos/publicPages", () => ({
  getSchoolSpotsGuidePhotos: async (slug: string) => ({
    hero: null,
    gallery: [],
    bySpot: WITH_PHOTOS.has(slug) ? { "main-quad": [{ id: "p1" }] } : { "main-quad": [] },
  }),
}));

describe("sitemap entries", async () => {
  const entries = await sitemap();
  const priorityOf = (path: string) => entries.find((e) => e.url === `${SITE}${path}`)?.priority;

  it("lists every campus spot guide", () => {
    for (const slug of ["uc-berkeley", "sjsu", "usf", "sf-state", "csueb", "santa-clara", "stanford"]) {
      expect(priorityOf(`/grads/${slug}/spots`)).toBeDefined();
    }
  });

  it("weights spot guides with photos above text-only ones", () => {
    expect(priorityOf("/grads/sjsu/spots")).toBe(0.8);
    expect(priorityOf("/grads/usf/spots")).toBe(0.8);
    expect(priorityOf("/grads/csueb/spots")).toBe(0.5);
    expect(priorityOf("/grads/santa-clara/spots")).toBe(0.5);
    expect(priorityOf("/grads/stanford/spots")).toBe(0.5);
  });

  it("includes the published Palace of Fine Arts couples guide and no unpublished guide", () => {
    expect(priorityOf("/couples-guide/locations/palace-of-fine-arts")).toBe(0.7);
    expect(priorityOf("/portrait-guide/locations/palace-of-fine-arts")).toBeUndefined();
  });

  it("leaves the noindex link hub out", () => {
    expect(priorityOf("/links")).toBeUndefined();
  });
});
