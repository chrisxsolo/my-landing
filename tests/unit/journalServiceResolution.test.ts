// Journal post → service, for the links under each post: structured data first,
// title keywords only for legacy posts.
import { describe, expect, it } from "vitest";
import { exploreLinksFor, resolvePostService } from "@/lib/blog/postService";
import { normalizeCategoryTag } from "@/lib/blog/postCategories";

const tagToCategory = (tag: string) => normalizeCategoryTag(tag)?.slug ?? null;

describe("resolvePostService", () => {
  it("prefers an explicit category tag over the title", () => {
    expect(resolvePostService({
      categoryTags: ["professional", "graduation"],
      tagToCategory,
      text: "A couple of favorite frames from Sather Gate",
    })).toBe("grads");
  });

  it("uses the Content Engine session when the post has no category tag", () => {
    expect(resolvePostService({
      categoryTags: ["professional", "professional"],
      engineService: "grads",
      tagToCategory,
      text: "Trang and her couple of best friends at Doe Library",
    })).toBe("grads");
  });

  it("falls back to title keywords for legacy posts", () => {
    expect(resolvePostService({ categoryTags: ["professional"], tagToCategory, text: "Golden Hour Couples Session" })).toBe("couples");
    expect(resolvePostService({ text: "Spartan Proud — A Grad Shoot Across SJSU" })).toBe("grads");
  });

  it("maps proposals and elopements to couples links", () => {
    expect(resolvePostService({ categoryTags: ["proposal"], tagToCategory, text: "x" })).toBe("couples");
    expect(resolvePostService({ categoryTags: ["elopements"], tagToCategory, text: "x" })).toBe("couples");
  });
});

describe("exploreLinksFor", () => {
  const hrefs = (service: Parameters<typeof exploreLinksFor>[0]) => exploreLinksFor(service, null).map((l) => l.href);

  it("gives couples posts couples pricing, portfolio, and guide — no grad links", () => {
    expect(hrefs("couples")).toEqual(expect.arrayContaining(["/pricing/couples", "/portfolio/couples", "/couples-guide"]));
    expect(hrefs("couples").some((h) => h.includes("grad"))).toBe(false);
  });

  it("gives graduation posts grad pricing and guides, plus the school page when known", () => {
    expect(hrefs("grads")).toEqual(expect.arrayContaining(["/pricing/grads", "/grad-guide"]));
    expect(exploreLinksFor("grads", { label: "UC Berkeley", href: "/grads/uc-berkeley" })[0].href).toBe("/grads/uc-berkeley");
  });

  it("gives family and maternity posts their own pricing", () => {
    expect(hrefs("families")).toContain("/pricing/families");
    expect(hrefs("maternity")).toContain("/pricing/maternity");
    expect(hrefs("maternity").some((h) => h.includes("couples") || h.includes("grad"))).toBe(false);
  });
});
