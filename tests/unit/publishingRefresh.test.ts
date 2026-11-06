// The worker's cache refresh reports exactly which paths did not get marked,
// so a failure becomes retryable follow-up work instead of a silent success.
import { describe, it, expect } from "vitest";
import { BLOG_CATEGORY_PATTERN, publicPathsForBlogPost, refreshPublicPaths } from "@/lib/contentPublishing/refresh";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";

describe("refreshPublicPaths", () => {
  it("busts the shared tag first, then marks every path (patterns as pages)", () => {
    const calls: string[] = [];
    const r = refreshPublicPaths(publicPathsForBlogPost("golden-hour"), {
      tag: (tag, profile) => calls.push(`tag:${tag}:${profile.expire}`),
      path: (path, type) => calls.push(`path:${path}${type ? `:${type}` : ""}`),
    });
    expect(r.ok).toBe(true);
    expect(calls).toEqual([
      `tag:${PUBLIC_CONTENT_CACHE_TAG}:0`, "path:/blog", "path:/blog/golden-hour",
      `path:${BLOG_CATEGORY_PATTERN}:page`, "path:/sitemap.xml",
    ]);
  });

  it("a failing path is reported and the rest still run", () => {
    const r = refreshPublicPaths(["/blog", "/blog/x", "/sitemap.xml"], {
      tag: () => {}, path: (p) => { if (p === "/blog/x") throw new Error("backend down"); },
    });
    expect(r.ok).toBe(false);
    expect(r.failed).toEqual(["/blog/x"]);
    expect(r.refreshed).toEqual(["/blog", "/sitemap.xml"]);
    expect(r.error).toMatch(/backend down/);
  });

  it("a failing tag bust marks every path as pending (the data cache still holds the old reads)", () => {
    const r = refreshPublicPaths(["/blog", "/blog/x"], { tag: () => { throw new Error("no cache"); }, path: () => {} });
    expect(r.ok).toBe(false);
    expect(r.failed).toEqual(["/blog", "/blog/x"]);
    expect(r.refreshed).toEqual([]);
  });

  it("never throws", () => {
    expect(() => refreshPublicPaths(["/a"], { tag: () => { throw new Error("x"); }, path: () => { throw new Error("y"); } })).not.toThrow();
  });
});
