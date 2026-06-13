import { describe, it, expect } from "vitest";
import {
  normalizeEventPath, normalizeReferrer, isLikelyBot,
  normalizeVisitorId, sanitizeMeta,
  TRACKED_EVENT_TYPES, TRACKED_CONTENT_TYPES,
} from "@/lib/contentEngine/trackEventRules";

describe("normalizeEventPath (spec §10)", () => {
  it("strips query/hash and accepts known route patterns", () => {
    expect(normalizeEventPath("/blog/golden-hour-sjsu?utm_source=ig#top")).toBe("/blog/golden-hour-sjsu");
    expect(normalizeEventPath("/grads/sjsu")).toBe("/grads/sjsu");
    expect(normalizeEventPath("/family-guide/locations/crissy-field")).toBe("/family-guide/locations/crissy-field");
    expect(normalizeEventPath("/portfolio")).toBe("/portfolio");
    expect(normalizeEventPath("/")).toBe("/");
  });
  it("rejects unknown routes, traversal junk, and over-long paths", () => {
    expect(normalizeEventPath("/admin/content-engine")).toBeNull();
    expect(normalizeEventPath("/api/track-event")).toBeNull();
    expect(normalizeEventPath("/blog/" + "x".repeat(300))).toBeNull();
    expect(normalizeEventPath("not-a-path")).toBeNull();
    expect(normalizeEventPath("/grads/../etc")).toBeNull();
  });
});

describe("normalizeReferrer", () => {
  it("reduces to a hostname, 'direct' when absent/invalid", () => {
    expect(normalizeReferrer("https://www.google.com/search?q=x")).toBe("www.google.com");
    expect(normalizeReferrer("https://l.instagram.com/?u=…")).toBe("l.instagram.com");
    expect(normalizeReferrer("")).toBe("direct");
    expect(normalizeReferrer(undefined)).toBe("direct");
    expect(normalizeReferrer("not a url")).toBe("direct");
  });
});

describe("isLikelyBot", () => {
  it("flags common crawlers and headless agents, passes real browsers", () => {
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("python-requests/2.31")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15")).toBe(false);
    expect(isLikelyBot(null)).toBe(true); // no UA = not a browser
  });
});

describe("normalizeVisitorId", () => {
  it("accepts a UUID-shaped token", () => {
    expect(normalizeVisitorId("a1b2c3d4-e5f6-4789-abcd-1234567890ef"))
      .toBe("a1b2c3d4-e5f6-4789-abcd-1234567890ef");
  });
  it("rejects non-strings, empties, oversized, and unsafe characters", () => {
    expect(normalizeVisitorId(null)).toBeNull();
    expect(normalizeVisitorId("")).toBeNull();
    expect(normalizeVisitorId("a".repeat(65))).toBeNull();
    expect(normalizeVisitorId("drop;--table")).toBeNull();
    expect(normalizeVisitorId("has spaces")).toBeNull();
  });
});

describe("sanitizeMeta", () => {
  it("keeps whitelisted keys with primitive values", () => {
    expect(sanitizeMeta({ sessionType: "Couples Session", estimatedTotalCents: 45000 }))
      .toEqual({ sessionType: "Couples Session", estimatedTotalCents: 45000 });
  });
  it("drops unknown keys, bad types, and returns null when empty", () => {
    expect(sanitizeMeta({ evil: "x", note: "free text" })).toBeNull();
    expect(sanitizeMeta({ estimatedTotalCents: Number.NaN })).toBeNull();
    expect(sanitizeMeta(null)).toBeNull();
    expect(sanitizeMeta([1, 2, 3])).toBeNull();
  });
  it("caps string length at 120 chars", () => {
    const out = sanitizeMeta({ school: "x".repeat(200) });
    expect(out?.school).toHaveLength(120);
  });
});

describe("allowlists (page/cta + booking funnel events)", () => {
  it("limits event and content types", () => {
    expect([...TRACKED_EVENT_TYPES]).toEqual([
      "page_view", "cta_click", "pricing_view", "estimator_start",
      "estimator_complete", "availability_selected", "inquiry_start", "inquiry_submit",
    ]);
    expect(TRACKED_CONTENT_TYPES).toContain("blog_post");
    expect(TRACKED_CONTENT_TYPES).toContain("school_page");
  });
});
