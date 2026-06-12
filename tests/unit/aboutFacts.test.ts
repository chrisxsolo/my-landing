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
  it("accepts known slugs", () => {
    expect(isValidAboutFactSlug("burritos")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidAboutFactSlug("nope")).toBe(false);
    expect(isValidAboutFactSlug(null)).toBe(false);
    expect(isValidAboutFactSlug(42)).toBe(false);
  });
});

describe("ABOUT_TIMELINE", () => {
  it("is chronological", () => {
    const years = ABOUT_TIMELINE.map((t) => t.year);
    expect([...years].sort()).toEqual(years);
  });
});
