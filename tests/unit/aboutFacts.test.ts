import { describe, it, expect } from "vitest";
import { ABOUT_FACTS, ABOUT_TIMELINE, isValidAboutFactSlug } from "@/lib/aboutFacts";

describe("ABOUT_FACTS", () => {
  it("has at least 3 facts with unique slugs", () => {
    expect(ABOUT_FACTS.length).toBeGreaterThanOrEqual(3);
    const slugs = ABOUT_FACTS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("every fact has a title and body", () => {
    for (const f of ABOUT_FACTS) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.body.length).toBeGreaterThan(20);
    }
  });
});

describe("isValidAboutFactSlug", () => {
  it("accepts every defined fact slug", () => {
    for (const f of ABOUT_FACTS) expect(isValidAboutFactSlug(f.slug)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidAboutFactSlug("nope")).toBe(false);
    expect(isValidAboutFactSlug(null)).toBe(false);
    expect(isValidAboutFactSlug(42)).toBe(false);
  });
});

describe("ABOUT_TIMELINE", () => {
  it("is chronological", () => {
    // Years are 4-digit numeric strings; compare numerically so a future
    // non-numeric label ("Today") fails loudly instead of sorting alphabetically.
    const years = ABOUT_TIMELINE.map((t) => Number(t.year));
    for (const y of years) expect(Number.isInteger(y)).toBe(true);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });
});
