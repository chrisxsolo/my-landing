import { describe, it, expect } from "vitest";
import {
  ABOUT_FACTS,
  ABOUT_TIMELINE,
  isValidAboutFactSlug,
  orderAboutFacts,
  resolveAboutFacts,
  validateAboutFactContent,
} from "@/lib/aboutFacts";

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

describe("orderAboutFacts", () => {
  const defaultSlugs = ABOUT_FACTS.map((f) => f.slug);

  it("returns the default order for null / non-array input", () => {
    expect(orderAboutFacts(null).map((f) => f.slug)).toEqual(defaultSlugs);
    expect(orderAboutFacts("junk").map((f) => f.slug)).toEqual(defaultSlugs);
  });
  it("applies a complete stored order", () => {
    const reversed = [...defaultSlugs].reverse();
    expect(orderAboutFacts(reversed).map((f) => f.slug)).toEqual(reversed);
  });
  it("drops unknown slugs and appends missing facts in default order", () => {
    const partial = [defaultSlugs[2], "bogus", defaultSlugs[0]];
    const result = orderAboutFacts(partial).map((f) => f.slug);
    expect(result.slice(0, 2)).toEqual([defaultSlugs[2], defaultSlugs[0]]);
    expect(new Set(result)).toEqual(new Set(defaultSlugs));
    expect(result).toHaveLength(defaultSlugs.length);
  });
  it("ignores duplicate slugs", () => {
    const dupes = [defaultSlugs[1], defaultSlugs[1], defaultSlugs[1]];
    const result = orderAboutFacts(dupes).map((f) => f.slug);
    expect(result).toHaveLength(defaultSlugs.length);
    expect(result[0]).toBe(defaultSlugs[1]);
  });
});

describe("validateAboutFactContent", () => {
  it("accepts trimmed editable fact text", () => {
    expect(validateAboutFactContent({ title: "  New headline  ", body: "  My own fact description.  " })).toEqual({
      ok: true,
      content: { title: "New headline", body: "My own fact description." },
    });
  });

  it("rejects missing or oversized text", () => {
    expect(validateAboutFactContent({ title: "", body: "Description" }).ok).toBe(false);
    expect(validateAboutFactContent({ title: "Headline", body: " " }).ok).toBe(false);
    expect(validateAboutFactContent({ title: "x".repeat(101), body: "Description" }).ok).toBe(false);
    expect(validateAboutFactContent({ title: "Headline", body: "x".repeat(801) }).ok).toBe(false);
  });
});

describe("resolveAboutFacts", () => {
  it("applies valid saved text without changing fact identity", () => {
    const facts = resolveAboutFacts({
      running: { title: "Morning miles", body: "I use my runs to find new corners of San Francisco." },
    });
    const running = facts.find((fact) => fact.slug === "running");

    expect(running).toEqual({
      slug: "running",
      title: "Morning miles",
      body: "I use my runs to find new corners of San Francisco.",
    });
    expect(facts.map((fact) => fact.slug)).toEqual(ABOUT_FACTS.map((fact) => fact.slug));
  });

  it("ignores unknown slugs and malformed overrides", () => {
    expect(resolveAboutFacts({
      running: { title: "", body: "Invalid because the title is blank." },
      unknown: { title: "Unknown", body: "This should never become a new fact." },
    })).toEqual(ABOUT_FACTS);
  });

  it("orders resolved facts while preserving edited content", () => {
    const facts = resolveAboutFacts({
      burritos: { title: "Mission burrito research", body: "I am still testing contenders across San Francisco." },
    });
    const ordered = orderAboutFacts(["burritos"], facts);

    expect(ordered[0].slug).toBe("burritos");
    expect(ordered[0].title).toBe("Mission burrito research");
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
