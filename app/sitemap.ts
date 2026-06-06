import type { MetadataRoute } from "next";
import { getBlogPostSummaries } from "@/lib/professionalData";

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
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing/grads", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing/couples", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing/families", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing/events", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide", changeFrequency: "monthly", priority: 0.8 },
  { path: "/grad-guide/what-to-wear", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide/how-to-prepare", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide/posing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/grad-guide/campus-spots", changeFrequency: "monthly", priority: 0.7 },
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
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Pull dynamic posts. /blog/[slug] is the server-rendered, canonical version
  // of every published entry. (The former /journal section has been retired.)
  const professional = await getBlogPostSummaries("professional");

  const blogEntries: MetadataRoute.Sitemap = professional.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.published_at ? new Date(post.published_at) : now,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
