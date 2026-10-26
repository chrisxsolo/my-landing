import { describe, expect, it } from "vitest";
import {
  buildCategoryFilters,
  normalizeCategoryTag,
  resolvePostCategories,
} from "@/lib/blog/postCategories";

const post = (title: string, slug: string, sites: string[] = ["professional"]) => ({
  title, slug, sites, category: "professional",
});

describe("normalizeCategoryTag", () => {
  it("merges naming variants of the same category", () => {
    for (const tag of ["grad", "graduation", "Graduation Photography", "grads-photos"]) {
      expect(normalizeCategoryTag(tag)?.slug).toBe("graduation");
    }
    for (const tag of ["couple", "couples", "couples-photography", "engagement-photography"]) {
      expect(normalizeCategoryTag(tag)?.slug).toBe("couples");
    }
    for (const tag of ["family", "family photography", "family-photography", "families"]) {
      expect(normalizeCategoryTag(tag)?.slug).toBe("family");
    }
    expect(normalizeCategoryTag("portrait-photography")?.slug).toBe("portraits");
  });

  it("ignores site tags and blanks", () => {
    expect(normalizeCategoryTag("professional")).toBeNull();
    expect(normalizeCategoryTag("journal")).toBeNull();
    expect(normalizeCategoryTag("  ")).toBeNull();
    expect(normalizeCategoryTag("photography")).toBeNull();
  });

  it("turns an unknown tag into its own category instead of merging it", () => {
    expect(normalizeCategoryTag("brand-photography")).toEqual({ slug: "brand", label: "Brand" });
    expect(normalizeCategoryTag("pet_portraits")).toEqual({ slug: "pet-portraits", label: "Pet Portraits" });
  });
});

describe("resolvePostCategories", () => {
  it("prefers explicit category tags", () => {
    const tagged = post("Golden Hour at Baker Beach", "baker-beach", ["professional", "family-photography"]);
    expect(resolvePostCategories(tagged, "couples").map((c) => c.slug)).toEqual(["family"]);
  });

  it("uses the Content Engine session service when the title is vague", () => {
    expect(resolvePostCategories(post("Golden Light in Lovers Lane", "lovers-lane"), "couples")[0]?.slug).toBe("couples");
  });

  it("falls back to title + slug keywords", () => {
    expect(resolvePostCategories(post("Kim at Sather Gate — Berkeley Class of 2026", "kim"), null)[0]?.slug).toBe("graduation");
    expect(resolvePostCategories(post("Spartan Proud — A Grad Shoot Across SJSU", "spartan"), null)[0]?.slug).toBe("graduation");
  });

  it("splits proposals and elopements out of couples", () => {
    expect(resolvePostCategories(post("A Sunset Proposal at Lands End", "lands-end-proposal"), "couples")[0]?.slug).toBe("proposals");
    expect(resolvePostCategories(post("Eloping in Big Sur", "big-sur-elopement"), null)[0]?.slug).toBe("elopements");
  });

  it("leaves unclassifiable posts uncategorized (All Posts only)", () => {
    expect(resolvePostCategories(post("Notes from the studio", "studio-notes"), null)).toEqual([]);
    expect(resolvePostCategories(post("Notes from the studio", "studio-notes"), "other")).toEqual([]);
  });
});

describe("buildCategoryFilters", () => {
  it("lists only categories with posts, in display order, with counts", () => {
    const grad = { slug: "graduation", label: "Graduation" };
    const couples = { slug: "couples", label: "Couples" };
    const brand = { slug: "brand", label: "Brand" };
    const filters = buildCategoryFilters([[couples], [grad], [grad], [], [brand]]);
    expect(filters).toEqual([
      { ...grad, count: 2 },
      { ...couples, count: 1 },
      { ...brand, count: 1 },
    ]);
  });
});
