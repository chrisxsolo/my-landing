import { describe, expect, it } from "vitest";
import { fetchAllPages } from "@/lib/supabasePaging";

/** A fake table that serves ranges, capped like PostgREST's max-rows. */
function table(total: number, serverCap = 1000) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + serverCap);
    return Promise.resolve({ data: rows.slice(from, end), error: null });
  };
  return { page, calls };
}

describe("fetchAllPages", () => {
  it("reads past the 1000-row cap (2,350 photos)", async () => {
    const { page } = table(2350);
    const rows = await fetchAllPages<{ id: number }>(page, "photos");
    expect(rows).toHaveLength(2350);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2350);
  });

  it("reads everything when the server caps lower than the page size", async () => {
    const { page } = table(1200, 500);
    expect(await fetchAllPages(page, "photos")).toHaveLength(1200);
  });

  it("handles exactly one full page and an empty table", async () => {
    expect(await fetchAllPages(table(1000).page, "photos")).toHaveLength(1000);
    expect(await fetchAllPages(table(0).page, "photos")).toEqual([]);
  });

  it("throws instead of returning a partial read", async () => {
    let n = 0;
    const page = (from: number) => {
      n += 1;
      return Promise.resolve(n === 1
        ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: from + i })), error: null }
        : { data: null, error: { message: "timeout" } });
    };
    await expect(fetchAllPages(page, "photos")).rejects.toThrow(/could not load photos \(rows from 1000\): timeout/);
  });
});
