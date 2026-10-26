import type { MetadataRoute } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// app/robots.ts — served at /robots.txt
//
// Allow crawling of all public pages; block private/admin/auth/api surfaces and
// utility pages that should never appear in search. Points crawlers at the
// sitemap so they can discover journal entries and landing pages.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://www.soloxsnaps.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // /api/availability is the one public, machine-readable API (open dates
      // only, no private notes). The longer, more specific Allow wins over the
      // blanket /api/ Disallow; every other API route stays blocked.
      allow: ["/", "/api/availability"],
      disallow: [
        "/admin",
        "/dashboard",
        "/login",
        "/auth/",
        "/api/",
        "/contact/thanks",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
