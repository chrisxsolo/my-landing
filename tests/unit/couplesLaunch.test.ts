import { describe, it, expect } from "vitest";
import { distributeIntoColumns } from "@/lib/masonry";
import {
  groupBySession,
  planCouplesReorder,
  validateCouplesPortfolioUpdates,
} from "@/lib/couplesPortfolioAdmin";
import { GUIDE_ADD_ONS, GUIDE_PACKAGES, HUB_FAQS, TURNAROUND_WEEKS } from "@/lib/couplesGuide/hubContent";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { exploreLinksFor } from "@/lib/blog/postService";
import { getBlogCategory } from "@/lib/blogCategories";

describe("masonry columns", () => {
  it("keeps reading order by filling the shortest column", () => {
    const portrait = { width: 4, height: 5 };
    const landscape = { width: 3, height: 2 };
    expect(distributeIntoColumns([portrait, portrait, landscape, portrait], 2)).toEqual([[0, 2], [1, 3]]);
  });

  it("puts every item in exactly one column and survives bad sizes", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ width: i % 3 === 0 ? 0 : 3, height: 4 }));
    const cols = distributeIntoColumns(items, 3);
    expect(cols).toHaveLength(3);
    expect(cols.flat().sort((a, b) => a - b)).toEqual(items.map((_, i) => i));
  });
});

describe("couples portfolio admin", () => {
  it("reorders by reusing the existing sort_order slots", () => {
    const current = [{ id: 1, sort_order: 10 }, { id: 2, sort_order: 20 }, { id: 3, sort_order: 30 }];
    expect(planCouplesReorder(current, [3, 1, 2])).toEqual([
      { id: 3, sort_order: 10 }, { id: 1, sort_order: 20 }, { id: 2, sort_order: 30 },
    ]);
  });

  it("forces strictly increasing order when slots repeat", () => {
    const current = [{ id: 1, sort_order: 5 }, { id: 2, sort_order: 5 }];
    expect(planCouplesReorder(current, [2, 1])).toEqual([{ id: 2, sort_order: 5 }, { id: 1, sort_order: 6 }]);
  });

  it("rejects an order that doesn't match the current photos", () => {
    const current = [{ id: 1, sort_order: 1 }, { id: 2, sort_order: 2 }];
    expect(planCouplesReorder(current, [1])).toBeNull();
    expect(planCouplesReorder(current, [1, 1])).toBeNull();
    expect(planCouplesReorder(current, [1, 9])).toBeNull();
  });

  it("whitelists editable fields and trims text", () => {
    const result = validateCouplesPortfolioUpdates({
      published: false, session_label: "  Baker   Beach  ", category_hero: true, image_url: "x",
    });
    expect(result).toEqual({ ok: true, data: { published: false, session_label: "Baker Beach" } });
    expect(validateCouplesPortfolioUpdates({ alt: "   " }).ok).toBe(false);
    expect(validateCouplesPortfolioUpdates({ width: 10 }).ok).toBe(false);
    expect(validateCouplesPortfolioUpdates({}).ok).toBe(false);
  });

  it("groups photos by session in first-appearance order", () => {
    const groups = groupBySession([
      { id: 1, session_label: "A" }, { id: 2, session_label: null }, { id: 3, session_label: "A" },
    ]);
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([["A", [1, 3]], ["", [2]]]);
  });
});

describe("couples guide content comes from the pricing catalog", () => {
  it("lists every couples package at its catalog price", () => {
    const catalog = PRICING_CATALOG.couples.packages;
    expect(GUIDE_PACKAGES).toHaveLength(Object.keys(catalog).length);
    expect(GUIDE_PACKAGES.find((p) => p.key === "1hr")?.price).toBe(`$${catalog["1hr"].price}`);
    expect(GUIDE_PACKAGES.find((p) => p.key === "proposal")?.price).toBe(`from $${catalog.proposal.price}`);
  });

  it("includes the client proofing gallery add-on at its catalog price", () => {
    const proofing = GUIDE_ADD_ONS.find((a) => a.key === "proofingGallery");
    expect(proofing?.price).toBe(`+$${PRICING_CATALOG.couples.addOns.proofingGallery.price}`);
  });

  it("answers the nine launch FAQs, including how to book", () => {
    expect(HUB_FAQS).toHaveLength(9);
    expect(HUB_FAQS.map((f) => f.q)).toContain("How do we book?");
    expect(TURNAROUND_WEEKS).toBe(PRICING_CATALOG.standardTurnaroundDays / 7);
  });
});

describe("couples journal integration", () => {
  it("couples posts link the portfolio, guide, and pricing", () => {
    const hrefs = exploreLinksFor("couples", null).map((l) => l.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/portfolio/couples", "/couples-guide", "/pricing/couples"]));
  });

  it("the couples journal archive collects posts detected as couples sessions", () => {
    expect(getBlogCategory("couples-photography")?.service).toBe("couples");
  });
});
