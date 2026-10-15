import { describe, it, expect } from "vitest";
import {
  buildGoldenHourWindow,
  computeSunsetUtc,
  formatLocalTime,
  goldenHourCaveat,
} from "@/lib/ai/goldenHour";

describe("computeSunsetUtc", () => {
  // Checked against published San Francisco sunset times. A minute of drift is
  // expected from sea-level geometric sunset; anything larger is a real bug.
  const cases: [string, string][] = [
    ["2026-06-21", "8:34 pm"], // summer solstice, PDT
    ["2026-12-21", "4:54 pm"], // winter solstice, PST
    ["2026-10-14", "6:34 pm"],
    ["2026-03-15", "7:16 pm"], // after the DST switch
    ["2026-11-26", "4:52 pm"], // after the switch back
  ];

  it.each(cases)("puts %s sunset at %s in San Francisco", (date, expected) => {
    const sunset = computeSunsetUtc(date);
    expect(sunset).not.toBeNull();
    expect(formatLocalTime(sunset!)).toBe(expected);
  });

  it("returns null for an unparseable date rather than an invalid Date", () => {
    expect(computeSunsetUtc("not-a-date")).toBeNull();
  });

  it("returns null above the Arctic circle in midsummer", () => {
    expect(computeSunsetUtc("2026-06-21", 78.2, 15.6)).toBeNull();
  });
});

describe("formatLocalTime", () => {
  it("writes am/pm lowercase with a space, as Chris does", () => {
    const sunset = computeSunsetUtc("2026-06-21")!;
    expect(formatLocalTime(sunset)).toMatch(/^\d{1,2}:\d{2} (am|pm)$/);
  });
});

describe("buildGoldenHourWindow", () => {
  it("recommends starting an hour before sunset", () => {
    const window = buildGoldenHourWindow("2026-10-14", 60)!;
    expect(window.sunset).toBe("6:34 pm");
    expect(window.recommendedStart).toBe("5:34 pm");
  });

  it("walks the latest start back by the session length so it ends at sunset", () => {
    const thirty = buildGoldenHourWindow("2026-10-14", 30)!;
    const ninety = buildGoldenHourWindow("2026-10-14", 90)!;
    expect(thirty.latestStart).toBe("6:04 pm");
    expect(ninety.latestStart).toBe("5:04 pm");
  });
});

describe("goldenHourCaveat", () => {
  it("warns that wooded locations lose light before sunset", () => {
    expect(goldenHourCaveat("Muir Woods")).toMatch(/wooded/i);
    expect(goldenHourCaveat("Lover's Lane in the Presidio")).toMatch(/wooded/i);
  });

  it("notes sunrise when the client talks about mornings", () => {
    expect(goldenHourCaveat("somewhere quiet in the morning")).toMatch(/sunrise/i);
  });

  it("stays quiet when there is nothing to caveat", () => {
    expect(goldenHourCaveat("Crissy Field")).toBeNull();
    expect(goldenHourCaveat(null)).toBeNull();
  });
});
