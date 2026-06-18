import { describe, expect, it } from "vitest";
import {
  MAX_ADMIN_DAY_OFFSET,
  MIN_ADMIN_DAY_OFFSET,
  buildAdminDayRange,
  clampAdminDayOffset,
} from "@/lib/analytics/adminDayRange";

describe("admin analytics day range", () => {
  it("builds yesterday and compares it with the preceding full day", () => {
    const range = buildAdminDayRange(new Date(2026, 5, 18, 15, 30), 1);

    expect(range.currStart).toEqual(new Date(2026, 5, 17, 0, 0, 0, 0));
    expect(range.currEnd).toEqual(new Date(2026, 5, 17, 23, 59, 59, 999));
    expect(range.prevStart).toEqual(new Date(2026, 5, 16, 0, 0, 0, 0));
    expect(range.prevEnd).toEqual(new Date(2026, 5, 16, 23, 59, 59, 999));
    expect(range.periodLabel).toBe("Wed, Jun 17");
    expect(range.trendLabel).toBe("the previous day (Tue, Jun 16)");
  });

  it("supports seven completed days and clamps navigation", () => {
    const range = buildAdminDayRange(new Date(2026, 5, 18, 15, 30), 7);

    expect(range.currStart).toEqual(new Date(2026, 5, 11, 0, 0, 0, 0));
    expect(clampAdminDayOffset(0)).toBe(MIN_ADMIN_DAY_OFFSET);
    expect(clampAdminDayOffset(8)).toBe(MAX_ADMIN_DAY_OFFSET);
  });
});
