import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/contentEngine/concurrency";

const tick = () => new Promise((r) => setTimeout(r, 1));

describe("mapWithConcurrency", () => {
  it("returns results in input order regardless of completion order", async () => {
    const delays = [30, 1, 20, 2, 10];
    const out = await mapWithConcurrency(delays, 3, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3, 4]);
  });

  it("never runs more than `limit` workers at once", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
      return null;
    });
    expect(peak).toBe(4);
  });

  it("runs everything when the limit exceeds the item count", async () => {
    const out = await mapWithConcurrency([1, 2, 3], 99, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6]);
  });

  it("coerces a nonsensical limit to a single lane", async () => {
    let peak = 0;
    let inFlight = 0;
    for (const limit of [0, -5, Number.NaN]) {
      await mapWithConcurrency([1, 2, 3], limit, async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
        return null;
      });
    }
    expect(peak).toBe(1);
  });

  it("does nothing for an empty list", async () => {
    let calls = 0;
    const out = await mapWithConcurrency([], 4, async () => {
      calls += 1;
      return 1;
    });
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });

  it("propagates a worker rejection", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});
