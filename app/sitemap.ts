import type { MetadataRoute } from "next";
import { getBlogPostSummaries, getBlogPostSummariesForCategory } from "@/lib/professionalData";
import { getPublishedFamilyLocations } from "@/lib/familyGuide/locations";
import { getBlogCategorySlugs } from "@/lib/familyGuide/journal";

// ─────────────────────────────────────────────────────────────────────────────
// app/sitemap.ts — programmatic sitemap served at /sitemap.xml
//
// Lists every public, indexable route plus dynamic journal/blog entries pulled
// from Supabase. Private routes (admin, dashboard, login, auth, api) are omitted
// here AND disallowed in robots.ts.
//
// Revalidates hourly so newly published journal entries appear without a redeploy.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://www.soloxsnaps.com";

export const revalidate = 3600;

// Static public routes with their relative SEO weight.
// priority is a hint only; Google treats it loosely, but it documents intent.
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/grads/uc-berkeley", changeFrequency: "monthly", priority: 0.9 },
  { path: "/grads/sjsu", changeFrequency: "monthly", priority: 0.9 },
  { path: "/grads/usf", changeFrequency: "monthly", priority: 0.9 },
  { path: "/grads/sf-state", changeFrequency: "monthly", priority: 0.9 },
  { path: "/grads/csueb", changeFrequency: "monthly", priority: 0.9 },
  { path: "/grads/santa-clara", changeFrequency: "monthly", priority: 0.9 },
  { path: "/grads/stanford", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing/grads", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing/couples", changeFrequency: "monthly", priority: 0.7 },
  { path: "/couples-posing-guide", changeFrequency: "monthly", priority: 0.6 },
  { path: "/pricing/families", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing/events", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide", changeFrequency: "monthly", priority: 0.8 },
  { path: "/grad-guide/what-to-wear", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide/how-to-prepare", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide/posing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide/campus-spots", changeFrequency: "monthly", priority: 0.7 },
  { path: "/family-guide", changeFrequency: "monthly", priority: 0.8 },
  { path: "/family-guide/locations", changeFrequency: "monthly", priority: 0.7 },
  { path: "/family-guide/what-to-wear", changeFrequency: "monthly", priority: 0.6 },
  { path: "/family-guide/how-to-prepare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/family-guide/what-to-expect", changeFrequency: "monthly", priority: 0.6 },
  { path: "/family-guide/best-time-for-family-photos", changeFrequency: "monthly", priority: 0.6 },
  { path: "/family-guide/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/bay-area-locations", changeFrequency: "monthly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq/graduation", changeFrequency: "monthly", priority: 0.7 },
  { path: "/portfolio", changeFrequency: "weekly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/availability", changeFrequency: "weekly", priority: 0.6 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes intentionally omit lastModified: we have no real
  // per-page modification timestamps, and stamping "now" on every hourly
  // regeneration would broadcast a false "recently changed" signal.
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Pull dynamic posts. /blog/[slug] is the server-rendered, canonical version
  // of every published entry. (The former /journal section has been retired.)
  const professional = await getBlogPostSummaries("professional");

  const blogEntries: MetadataRoute.Sitemap = professional.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    // Real publish timestamp; only fall back to "now" if it's genuinely missing.
    lastModified: post.published_at ? new Date(post.published_at) : new Date(),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  // Individual family-location pages — generated from the published location
  // registry, so new locations appear in the sitemap automatically.
  const familyLocationEntries: MetadataRoute.Sitemap = getPublishedFamilyLocations().map((loc) => ({
    url: `${SITE_URL}${loc.canonicalPath}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Blog category archives (e.g. the family journal) — included only once a
  // category has at least one post, so empty/thin archives stay out of the index.
  const categoryResults = await Promise.all(
    getBlogCategorySlugs().map(async (slug) => ({
      slug,
      count: (await getBlogPostSummariesForCategory(slug)).length,
    })),
  );
  const categoryEntries: MetadataRoute.Sitemap = categoryResults
    .filter((c) => c.count > 0)
    .map((c) => ({
      url: `${SITE_URL}/blog/category/${c.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...staticEntries, ...familyLocationEntries, ...categoryEntries, ...blogEntries];
}
