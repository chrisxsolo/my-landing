import { describe, it, expect } from "vitest";
import {
  normalizeEventPath, normalizeReferrer, isLikelyBot,
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

describe("allowlists (v1 records page_view + cta_click only)", () => {
  it("limits event and content types", () => {
    expect([...TRACKED_EVENT_TYPES]).toEqual(["page_view", "cta_click"]);
    expect(TRACKED_CONTENT_TYPES).toContain("blog_post");
    expect(TRACKED_CONTENT_TYPES).toContain("school_page");
  });
});
