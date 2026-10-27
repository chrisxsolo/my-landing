// The public photo pool reads every published portfolio photo and every public
// session photo, past PostgREST's 1000-row page — and a failed page is an
// error, never a silently shorter gallery.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPhotoPool } from "@/lib/pagePhotos/pool";

const PAGE = 1000;

interface Query { table: string; range: [number, number] | null }

/** A chainable Supabase stand-in: `rowsFor` answers each awaited query. */
function fakeClient(rowsFor: (q: Query) => { data: unknown[]; error: { message: string } | null }): SupabaseClient {
  const builder = (q: Query): unknown => new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(rowsFor(q));
      }
      if (prop === "range") return (from: number, to: number) => builder({ ...q, range: [from, to] });
      return () => builder(q);
    },
  });
  return { from: (table: string) => builder({ table, range: null }) } as unknown as SupabaseClient;
}

function portfolioRow(id: number) {
  return { id, title: "Couple", alt: "Couple", image_url: `https://x/p${id}.jpg`, category_slug: "couples",
    featured: false, sort_order: id, width: 1, height: 1, content_hash: null, school: null, location: null, session_label: null };
}

const pageOf = (q: Query, total: number, make: (i: number) => unknown) => {
  if (!q.range) return [];
  const [from, to] = q.range;
  return Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => make(from + i));
};

describe("loadPhotoPool paging", () => {
  it("reads every published portfolio photo past the 1000-row page", async () => {
    const total = PAGE + 250;
    const pool = await loadPhotoPool(fakeClient((q) => ({
      data: q.table === "portfolio_images" ? pageOf(q, total, (i) => portfolioRow(i + 1)) : [], error: null,
    })));
    expect(pool.errors).toEqual([]);
    expect(pool.photos).toHaveLength(total);
  });

  it("reports a failed page instead of returning a partial pool", async () => {
    const pool = await loadPhotoPool(fakeClient((q) => (q.table === "session_photos" && q.range?.[0] === PAGE
      ? { data: [], error: { message: "timeout" } }
      : { data: q.table === "session_photos" ? pageOf(q, PAGE + 1, () => ({})) : [], error: null })));
    expect(pool.errors).toEqual([expect.stringMatching(/session_photos.*rows from 1000.*timeout/)]);
  });
});
