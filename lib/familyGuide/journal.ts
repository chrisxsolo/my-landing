// lib/familyGuide/journal.ts
// Family journal lives inside the existing /blog system — no second blog. Posts
// are tagged by adding a category slug to a post's `sites` array (or the legacy
// `category` column); a crawlable archive is served at /blog/category/<slug>.
//
// Only the categories listed here get an indexable archive page (generateStaticParams
// + dynamicParams=false), so we never create arbitrary thin category URLs. To add
// one, add an entry below — the route, sitemap, and links pick it up automatically.

export const FAMILY_JOURNAL_CATEGORY = "family-photography";

export type BlogCategory = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  /** Family categories surface a "back to the family guide" path. */
  family: boolean;
};

export const BLOG_CATEGORIES: Record<string, BlogCategory> = {
  "family-photography": {
    slug: "family-photography",
    title: "Family Photography Journal",
    description:
      "Family photography notes, location guides, and seasonal tips for San Francisco and the Bay Area from SoloXSnaps.",
    intro:
      "Notes, location guides, and seasonal tips for planning relaxed family photos in San Francisco and across the Bay Area.",
    family: true,
  },
};

export function getBlogCategory(slug: string): BlogCategory | null {
  return BLOG_CATEGORIES[slug] ?? null;
}

export function getBlogCategorySlugs(): string[] {
  return Object.keys(BLOG_CATEGORIES);
}
