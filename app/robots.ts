import type { MetadataRoute } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// app/robots.ts — served at /robots.txt
//
// Allow crawling of all public pages; block private/admin/auth/api surfaces and
// utility pages that should never appear in search. Points crawlers at the
// sitemap so they can discover journal entries and landing pages.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://soloxsnaps.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
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
