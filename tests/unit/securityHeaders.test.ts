// Every response carries the baseline hardening headers, and the legacy
// redirects still point where they always did.
import { describe, expect, it } from "vitest";
import nextConfig, { CSP_HEADER_NAME, SECURITY_HEADERS, buildContentSecurityPolicy } from "@/next.config";

const SUPABASE = "https://dmtslzwglpezympptqls.supabase.co";
const directive = (policy: string, name: string) =>
  policy.split("; ").find((part) => part.startsWith(`${name} `) || part === name) ?? "";

describe("security headers", () => {
  it("apply to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules[0].source).toBe("/(.*)");
    const keys = rules[0].headers.map((header) => header.key);
    expect(keys).toEqual(["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", CSP_HEADER_NAME]);
    expect(SECURITY_HEADERS.find((header) => header.key === "X-Content-Type-Options")?.value).toBe("nosniff");
    expect(["Content-Security-Policy", "Content-Security-Policy-Report-Only"]).toContain(CSP_HEADER_NAME);
  });

  // Dictation (Content Engine facts) and the email composer's voice input need
  // the page's own microphone; `microphone=()` disables it even for the page
  // itself (Chrome fires `not-allowed` with no prompt). The admin keeps every
  // other device API off and public pages keep the microphone off too.
  it("allow the microphone only for the admin's own origin", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(2);
    const policy = (rule: (typeof rules)[number]) => rule.headers.find((header) => header.key === "Permissions-Policy")?.value ?? "";
    expect(policy(rules[0])).toBe("camera=(), microphone=(), geolocation=()");
    expect(rules[1].source).toBe("/admin/:path*");
    expect(rules[1].headers).toHaveLength(1);
    expect(policy(rules[1])).toBe("camera=(), microphone=(self), geolocation=()");
  });

  it("the policy allows what the site loads and nothing broader", () => {
    const policy = buildContentSecurityPolicy();
    expect(directive(policy, "default-src")).toBe("default-src 'self'");
    expect(directive(policy, "img-src")).toContain("https:");
    expect(directive(policy, "connect-src")).toContain(SUPABASE);
    expect(directive(policy, "connect-src")).toContain("wss://dmtslzwglpezympptqls.supabase.co");
    expect(directive(policy, "connect-src")).toContain("https://api.sunrise-sunset.org");
    expect(directive(policy, "style-src")).toContain("https://fonts.googleapis.com");
    expect(directive(policy, "font-src")).toContain("https://fonts.gstatic.com");
    expect(directive(policy, "form-action")).toContain("https://accounts.google.com");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    // Scripts stay inline-tolerant (static pages cannot carry a nonce) but never eval in production.
    expect(directive(policy, "script-src")).toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ enforce: true })).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ enforce: false })).not.toContain("upgrade-insecure-requests");
    // No wildcard source anywhere.
    expect(policy).not.toMatch(/\s\*(;|$)/);
  });

  it("keeps the permanent redirects for retired URLs", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.every((redirect) => redirect.permanent)).toBe(true);
    expect(redirects.find((redirect) => redirect.source === "/journal/:slug")?.destination).toBe("/blog/:slug");
  });
});
