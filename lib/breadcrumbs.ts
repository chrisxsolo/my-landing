// ─────────────────────────────────────────────────────────────────────────────
// lib/breadcrumbs.ts — builds Schema.org BreadcrumbList JSON-LD.
//
// Breadcrumb rich results help Google show the page's place in the site
// hierarchy under the search result. Used by server-rendered pages that sit
// below the homepage (school landing pages, blog posts, FAQ pages).
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://soloxsnaps.com";

export type Crumb = { name: string; path: string };

export function buildBreadcrumbJsonLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
