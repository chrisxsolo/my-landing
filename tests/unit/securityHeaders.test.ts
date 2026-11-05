// Every response carries the baseline hardening headers, and the legacy
// redirects still point where they always did.
import { describe, expect, it } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "@/next.config";

describe("security headers", () => {
  it("apply to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
    const keys = rules[0].headers.map((header) => header.key);
    expect(keys).toEqual(["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]);
    expect(SECURITY_HEADERS.find((header) => header.key === "X-Content-Type-Options")?.value).toBe("nosniff");
    // A CSP is deliberately absent until its allowlist is audited.
    expect(keys).not.toContain("Content-Security-Policy");
  });

  it("keeps the permanent redirects for retired URLs", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.every((redirect) => redirect.permanent)).toBe(true);
    expect(redirects.find((redirect) => redirect.source === "/journal/:slug")?.destination).toBe("/blog/:slug");
  });
});
