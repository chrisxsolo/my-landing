import { describe, it, expect } from "vitest";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";

describe("pathsForPublishedItem (spec §9.1 Step C map)", () => {
  it("journal → blog index + post page", () => {
    expect(pathsForPublishedItem("journal_post", { slug: "golden-hour-sjsu" }))
      .toEqual(["/blog", "/blog/golden-hour-sjsu"]);
  });
  it("portfolio → /portfolio, plus / when featured", () => {
    expect(pathsForPublishedItem("portfolio_pick", { featured: false })).toEqual(["/portfolio"]);
    expect(pathsForPublishedItem("portfolio_pick", { featured: true })).toEqual(["/portfolio", "/"]);
  });
  it("school → its grads page", () => {
    expect(pathsForPublishedItem("school_page_photo", { school_slug: "sjsu" })).toEqual(["/grads/sjsu"]);
  });
  it("guide → its guide location page", () => {
    expect(pathsForPublishedItem("guide_photo", { guide: "family", location_key: "crissy-field" }))
      .toEqual(["/family-guide/locations/crissy-field"]);
    expect(pathsForPublishedItem("guide_photo", { guide: "couples", location_key: "ocean-beach" }))
      .toEqual(["/couples-guide/locations/ocean-beach"]);
  });
  it("photo-less types revalidate nothing", () => {
    expect(pathsForPublishedItem("testimonial_feature", {})).toEqual([]);
    expect(pathsForPublishedItem("internal_link_suggestion", {})).toEqual([]);
    expect(pathsForPublishedItem("unknown_type", {})).toEqual([]);
  });
});
