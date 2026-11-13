// Loose date parsing for the Pixieset autofill: every way a client writes
// November 29th lands on the same calendar day, a missing year is resolved
// from an explicit reference date in the business timezone (never the host
// clock), and a date that is not on the calendar is no date at all.

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { businessDate, formatReadable, parseLooseDate } from "@/lib/extension/sessionDates";

const REFERENCE = "2026-11-13";

describe("parseLooseDate", () => {
  it.each([
    "29th Nov", "29 Nov", "November 29th", "Nov. 29", "Nov 29", "29th of November", "29th Nov around 3pm",
    "2026-11-29", "11/29", "11/29/2026", "11/29/26", "November 29, 2026", "29 November 2026", "Sunday, 29th Nov",
  ])("reads %s as November 29th, 2026", (text) => {
    expect(parseLooseDate(text, REFERENCE)).toBe("2026-11-29");
  });

  it("reads a numeric or named date after a weekday, and lowercase months", () => {
    expect(parseLooseDate("Sunday 11/29", REFERENCE)).toBe("2026-11-29");
    expect(parseLooseDate("on 2026-11-29 please", REFERENCE)).toBe("2026-11-29");
    expect(parseLooseDate("saturday may 16", REFERENCE)).toBe("2027-05-16");
    expect(parseLooseDate("June 3 may work best", REFERENCE)).toBe("2027-06-03");
  });

  it("does not mistake a time, a fraction or odds for a numeric date", () => {
    expect(parseLooseDate("May 16 around 4/5pm", REFERENCE)).toBe("2027-05-16");
    expect(parseLooseDate("June 3 or June 10, 3/4 of group", REFERENCE)).toBe("2027-06-03");
    expect(parseLooseDate("May 16 at 6:30/7pm", REFERENCE)).toBe("2027-05-16");
    expect(parseLooseDate("50/50 between May 16 and May 17", REFERENCE)).toBe("2027-05-16");
    expect(parseLooseDate("available 24/7, let's do May 16", REFERENCE)).toBe("2027-05-16");
    expect(parseLooseDate("3/4 of us can make May 16", REFERENCE)).toBe("2027-05-16");
    expect(parseLooseDate("1/2 hour mini on May 16", REFERENCE)).toBe("2027-05-16");
  });

  it("does not take the time after a day-first date for the day", () => {
    expect(parseLooseDate("29th Nov 3pm", REFERENCE)).toBe("2026-11-29");
    expect(parseLooseDate("Nov 29 3pm", REFERENCE)).toBe("2026-11-29");
  });

  it("resolves a missing year to the first occurrence on or after the reference date", () => {
    expect(parseLooseDate("Nov 13", REFERENCE)).toBe("2026-11-13");
    expect(parseLooseDate("Nov 12", REFERENCE)).toBe("2027-11-12");
    expect(parseLooseDate("January 4th", "2026-12-30")).toBe("2027-01-04");
  });

  it("keeps an old conversation in its own year when read later", () => {
    // Written in March 2025 about May 16th: rereading it in 2026 must not move it.
    expect(parseLooseDate("May 16", "2025-03-02")).toBe("2025-05-16");
  });

  it("keeps an explicit year, including a past one", () => {
    expect(parseLooseDate("May 16, 2024", REFERENCE)).toBe("2024-05-16");
    expect(parseLooseDate("2024-05-16", REFERENCE)).toBe("2024-05-16");
  });

  it("rejects dates that are not on the calendar", () => {
    expect(parseLooseDate("February 30", REFERENCE)).toBeNull();
    expect(parseLooseDate("2027-02-29", REFERENCE)).toBeNull();
    expect(parseLooseDate("31st April", REFERENCE)).toBeNull();
    expect(parseLooseDate("13/45", REFERENCE)).toBeNull();
    expect(parseLooseDate("2026-13-01", REFERENCE)).toBeNull();
  });

  it("honours leap days", () => {
    expect(parseLooseDate("2028-02-29", REFERENCE)).toBe("2028-02-29");
    expect(parseLooseDate("Feb 29", REFERENCE)).toBe("2028-02-29");
  });

  it("returns null for text that is not a date", () => {
    expect(parseLooseDate("sometime this week", REFERENCE)).toBeNull();
    expect(parseLooseDate("around 3pm", REFERENCE)).toBeNull();
    expect(parseLooseDate("Nov 2026", REFERENCE)).toBeNull();
    expect(parseLooseDate(null, REFERENCE)).toBeNull();
  });
});

describe("businessDate", () => {
  it("is the calendar date in America/Los_Angeles, not UTC", () => {
    // 06:30 UTC on the 14th is still the evening of the 13th in California.
    expect(businessDate(new Date("2026-11-14T06:30:00Z"))).toBe("2026-11-13");
    expect(businessDate(new Date("2026-11-14T08:30:00Z"))).toBe("2026-11-14");
    expect(businessDate(new Date("2027-01-01T07:59:00Z"))).toBe("2026-12-31");
  });

  it("is what a Date reference resolves a missing year against", () => {
    // New Year's Eve evening in California: "Dec 31" is today, not next year.
    expect(parseLooseDate("Dec 31", new Date("2027-01-01T03:00:00Z"))).toBe("2026-12-31");
  });
});

describe("the extension's formatSessionDate mirrors the server parser", () => {
  const source = readFileSync(path.resolve(__dirname, "../../pixieset-extension/sessionDates.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const format = (raw: string | null, reference: string) => {
    Object.assign(context, { raw, reference });
    return vm.runInContext("formatSessionDate(raw, reference)", context) as string | null;
  };

  it.each([
    "29th Nov", "29 Nov", "November 29th", "Nov. 29", "2026-11-29", "11/29", "11/29/2026", "29th Nov 3pm",
    "February 30", "2027-02-29", "Feb 29", "Nov 12", "sometime this week", "May 16, 2024",
    "Sunday 11/29", "on 2026-11-29 please", "saturday may 16", "June 3 may work best", "13/45",
    "May 16 around 4/5pm", "June 3 or June 10, 3/4 of group", "May 16 at 6:30/7pm", "50/50 between May 16 and May 17",
    "available 24/7, let's do May 16", "3/4 of us can make May 16", "1/2 hour mini on May 16",
  ])("agrees on %s", (text) => {
    const iso = parseLooseDate(text, REFERENCE);
    expect(format(text, REFERENCE)).toBe(iso ? formatReadable(iso) : null);
  });
});
