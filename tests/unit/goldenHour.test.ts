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
  it("recommends starting an hour before sunset, rounded to the quarter hour", () => {
    const window = buildGoldenHourWindow("2026-10-14", 60)!;
    // Sunset stays exact because it is a fact; the start is a suggestion.
    expect(window.sunset).toBe("6:34 pm");
    expect(window.recommendedStart).toBe("5:30 pm");
  });

  it("walks the latest start back by the session length so it ends near sunset", () => {
    const thirty = buildGoldenHourWindow("2026-10-14", 30)!;
    const ninety = buildGoldenHourWindow("2026-10-14", 90)!;
    expect(thirty.latestStart).toBe("6:00 pm");
    expect(ninety.latestStart).toBe("5:00 pm");
  });

  it("never suggests an odd-minute start time", () => {
    // A live eval produced "I'd suggest starting around 5:18 pm", which is not
    // a time anyone proposes. Start times must land on :00/:15/:30/:45.
    const dates = ["2026-01-09", "2026-03-15", "2026-06-21", "2026-08-02", "2026-10-26", "2026-12-21"];
    for (const date of dates) {
      for (const minutes of [30, 60, 90]) {
        const window = buildGoldenHourWindow(date, minutes)!;
        expect(window.recommendedStart).toMatch(/:(00|15|30|45) (am|pm)$/);
        expect(window.latestStart).toMatch(/:(00|15|30|45) (am|pm)$/);
      }
    }
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
