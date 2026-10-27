// The admin's "import grad photos" button and batch upload must save portfolio
// rows on the REAL graduation category. The category table's slug is
// "graduation"; "grads" is only the display alias, and looking the category up
// by the alias left 16 rows with category_slug = 'grads' and no category_id.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminHandler } from "../helpers/loadAdminHandler";
import { normalizePortfolioCategorySlug } from "@/lib/photoMetadata";

const noop = () => {};
const toast = vi.fn();
const isGradCategory = (slug: string) => normalizePortfolioCategorySlug(slug) === "grads";
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(noop); });

const GRADUATION = { id: 1, slug: "graduation", name: "Graduation" };

function gradPhotoSupabase() {
  return {
    from: (table: string) => ({
      select: () => {
        const rows = table === "grad_photos" ? [{ id: 1, image_url: "https://x/g1.jpg", caption: "SJSU grad", created_at: "2026-01-01" }] : [];
        const result = { data: rows, error: null };
        return { ...result, order: () => Promise.resolve(result), then: (resolve: (v: unknown) => void) => resolve(result) };
      },
    }),
  };
}

describe("importGradPhotos", () => {
  it("saves imported rows on the graduation category's real id and slug", async () => {
    const posted: Record<string, unknown>[] = [];
    const handler = loadAdminHandler("importGradPhotos", {
      supabase: gradPhotoSupabase(), categories: [GRADUATION], portfolioImages: [], isGradCategory,
      fetch: async (_url: string, init: { body: string }) => { posted.push(JSON.parse(init.body)); return Response.json({}); },
      showToast: toast, setImporting: noop, fetchPortfolioImages: noop, revalidatePublicSite: noop,
    });
    await handler();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ category_id: 1, category_slug: "graduation" });
  });

  it("refuses to import when no graduation category exists, instead of saving category-less rows", async () => {
    const fetch = vi.fn();
    const handler = loadAdminHandler("importGradPhotos", {
      supabase: gradPhotoSupabase(), categories: [{ id: 8, slug: "couples", name: "Couples" }], portfolioImages: [], isGradCategory,
      fetch, showToast: toast, setImporting: noop, fetchPortfolioImages: noop, revalidatePublicSite: noop,
    });
    await handler();
    expect(fetch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/graduation category/i), false);
  });
});

describe("saveBatchImages", () => {
  it("stores the chosen school on graduation photos and never on other categories", async () => {
    const items = [
      { id: 1, file: {}, title: "Tower Hall", category_slug: "graduation", location: "", school: "sjsu", hash: "a", preview: "blob:a" },
      { id: 2, file: {}, title: "Beach", category_slug: "couples", location: "", school: "sjsu", hash: "b", preview: "blob:b" },
    ];
    let posted: Record<string, unknown>[] = [];
    const handler = loadAdminHandler("saveBatchImages", {
      batchItems: items, categories: [GRADUATION, { id: 8, slug: "couples", name: "Couples" }], portfolioImages: [], isGradCategory,
      fetch: async (_url: string, init: { body: string }) => { posted = JSON.parse(init.body); return Response.json({}); },
      showToast: toast, setBatchSaving: noop, setBatchItems: noop, setBatchSelected: noop, clearBatchSelection: noop,
      batchAnchorRef: { current: null }, fetchPortfolioImages: noop, revalidatePublicSite: noop,
      mapWithConcurrency: async (list: unknown[], _limit: number, fn: (v: unknown) => unknown) => Promise.all(list.map(fn)),
      uploadImage: async () => "https://x/p.jpg", URL: { revokeObjectURL: noop },
    });
    await handler();
    expect(posted.map((r) => [r.category_id, r.school])).toEqual([[1, "sjsu"], [8, null]]);
  });
});
