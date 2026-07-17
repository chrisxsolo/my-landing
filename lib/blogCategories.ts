// lib/blogCategories.ts
// Shared registry of curated blog category archives served at /blog/category/<slug>.
// Posts are tagged into a category by adding the category slug to a post's `sites`
// array (or the legacy `category` column); the archive route, the sitemap, and the
// per-guide journal strips all read from here.
//
// Only categories listed here get an indexable archive page (the route uses
// generateStaticParams + dynamicParams=false), so we never create arbitrary thin
// category URLs. A category with zero posts renders a tasteful empty state, is
// noindexed, and is excluded from the sitemap until it has at least one post.
//
// To add one: add an entry below — the route, sitemap, and links pick it up
// automatically. Set `guide` to cross-link an archive back to its planning guide.

export type BlogCategoryGuideLink = {
  /** Guide hub, e.g. "/couples-guide". */
  href: string;
  /** Anchor text, e.g. "Couples photography guide". */
  label: string;
  /** Locations hub, e.g. "/couples-guide/locations". */
  locationsHref: string;
  locationsLabel: string;
  /** Headline shown in the empty state before any posts exist. */
  emptyState: string;
};

export type BlogCategory = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  /** Optional cross-link back to the related planning guide. */
  guide?: BlogCategoryGuideLink;
};

export const BLOG_CATEGORIES: Record<string, BlogCategory> = {
  "family-photography": {
    slug: "family-photography",
    title: "Family Photography Journal",
    description:
      "Family photography notes, location guides, and seasonal tips for San Francisco and the Bay Area from SoloXSnaps.",
    intro:
      "Notes, location guides, and seasonal tips for planning relaxed family photos in San Francisco and across the Bay Area.",
    guide: {
      href: "/family-guide",
      label: "Family photography guide",
      locationsHref: "/family-guide/locations",
      locationsLabel: "Family photo locations",
      emptyState: "Family journal posts are on the way.",
    },
  },
  "couples-photography": {
    slug: "couples-photography",
    title: "Couples Photography Journal",
    description:
      "Couples photography notes, location guides, and session tips for San Francisco and the Bay Area from SoloXSnaps.",
    intro:
      "Notes, location guides, and session tips for planning natural, relaxed couples photos in San Francisco and across the Bay Area.",
    guide: {
      href: "/couples-guide",
      label: "Couples photography guide",
      locationsHref: "/couples-guide/locations",
      locationsLabel: "Couples photo locations",
      emptyState: "Couples journal posts are on the way.",
    },
  },
  "portrait-photography": {
    slug: "portrait-photography",
    title: "Portrait Photography Journal",
    description:
      "Lifestyle and individual portrait photography notes, location guides, and session tips for San Francisco and the Bay Area from SoloXSnaps.",
    intro:
      "Notes, location guides, and session tips for planning natural, relaxed lifestyle and individual portraits in San Francisco and across the Bay Area.",
    guide: {
      href: "/portrait-guide",
      label: "Lifestyle portrait guide",
      locationsHref: "/portrait-guide/locations",
      locationsLabel: "Portrait photo locations",
      emptyState: "Portrait journal posts are on the way.",
    },
  },
  "engagement-photography": {
    slug: "engagement-photography",
    title: "Engagement Photography Journal",
    description:
      "Engagement photography notes, location ideas, and planning tips for San Francisco and Bay Area couples from SoloXSnaps.",
    intro:
      "Location ideas and planning tips for engagement photos around San Francisco and the Bay Area — for save-the-dates, announcements, and a more intentional couples session.",
    guide: {
      href: "/couples-guide",
      label: "Couples photography guide",
      locationsHref: "/couples-guide/locations",
      locationsLabel: "Couples photo locations",
      emptyState: "Engagement journal posts are on the way.",
    },
  },
};

export function getBlogCategory(slug: string): BlogCategory | null {
  return BLOG_CATEGORIES[slug] ?? null;
}

export function getBlogCategorySlugs(): string[] {
  return Object.keys(BLOG_CATEGORIES);
}
