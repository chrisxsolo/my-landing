// Excluding a photo lists where it is still explicitly placed; nothing is
// removed automatically (owner decision pending). Each placement names the
// existing endpoint that would remove it, or only an editor link where the
// code belongs elsewhere (journal galleries, campus spot slots).
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gradSpotPlacement, guidePlacement, journalPlacement, locationHeroPlacement, portfolioPlacement, summarizePlacements,
} from "@/lib/photoExclusion/kinds";
import { listLivePlacements } from "@/lib/photoExclusion/placements";

const P1 = "22222222-2222-4222-8222-000000000001";
const P2 = "22222222-2222-4222-8222-000000000002";
const URL1 = "https://x.supabase.co/storage/v1/object/public/d/1.jpg";
const URL2 = "https://x.supabase.co/storage/v1/object/public/d/2.jpg";

describe("placement shapes", () => {
  it("names the removal endpoint only where an existing endpoint removes one placement", () => {
    expect(portfolioPlacement(P1, { id: 188, title: null }).removal).toEqual({ method: "DELETE", url: "/api/admin/portfolio-images?id=188" });
    expect(guidePlacement(P1, "couples_guide", { id: "abc", location_slug: "shark-fin-cove-santa-cruz" }).removal)
      .toEqual({ method: "DELETE", url: "/api/admin/couples-photos", body: { id: "abc" } });
    expect(locationHeroPlacement(P1, { id: 8, title: "Lovers' Lane" }).removal)
      .toEqual({ method: "PATCH", url: "/api/admin/location-library/8", body: { featured_photo_id: null } });
    expect(journalPlacement(P1, { id: 21, title: "Spring at Berkeley" })).toMatchObject({ removal: null, href: "/admin?tab=blog", where: "Journal post “Spring at Berkeley”" });
    expect(gradSpotPlacement(P1, { id: 3, name: null }).removal).toBeNull();
  });

  it("summarizes counts per kind", () => {
    const summary = summarizePlacements([
      journalPlacement(P1, { id: 21, title: null }), journalPlacement(P2, { id: 21, title: null }),
      portfolioPlacement(P1, { id: 188, title: null }),
    ]);
    expect(summary).toEqual({ count: 3, where: ["2 in journal posts", "1 in portfolio"] });
  });
});

/** A tiny PostgREST stand-in: each table answers with its fixed rows, whatever the filter. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>): SupabaseClient {
  const query = (rows: Record<string, unknown>[]) => {
    const q: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) };
    for (const m of ["select", "in", "eq", "overlaps", "not"]) q[m] = () => q;
    return q;
  };
  return { from: (table: string) => query(tables[table] ?? []) } as unknown as SupabaseClient;
}

describe("listLivePlacements", () => {
  it("finds every explicit placement of the batch in one pass per table, keyed by photo", async () => {
    const client = fakeClient({
      blog_posts: [{ id: 21, title: "Spring", cover_image_url: null, extra_image_urls: [URL1, URL2] }],
      portfolio_images: [{ id: 188, title: "Grad", image_url: URL1 }],
      couples_location_photos: [{ id: "c1", location_slug: "shark-fin-cove-santa-cruz", image_url: URL2 }],
      bay_area_locations: [{ id: 8, title: "Lovers' Lane", featured_photo_id: P2 }],
    });
    const map = await listLivePlacements(client, [{ id: P1, url: URL1 }, { id: P2, url: URL2 }, { id: "p3", url: null }]);
    expect(map.get(P1)?.map((p) => p.kind).sort()).toEqual(["journal", "portfolio"]);
    expect(map.get(P2)?.map((p) => p.kind).sort()).toEqual(["couples_guide", "journal", "location_hero"]);
    expect(map.has("p3")).toBe(false);
  });

  it("throws on a failed read rather than reporting no placements", async () => {
    const broken = { from: () => ({ select: () => ({ in: () => ({ eq: async () => ({ data: null, error: { message: "timeout" } }) }),
      overlaps: async () => ({ data: [], error: null }) }) }) } as unknown as SupabaseClient;
    await expect(listLivePlacements(broken, [{ id: P1, url: URL1 }])).rejects.toThrow(/could not read/);
  });
});
