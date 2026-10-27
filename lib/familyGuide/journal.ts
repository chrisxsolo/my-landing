// lib/familyGuide/journal.ts
// Names the primary family blog category. The shared category registry now lives
// in lib/blogCategories.ts; this file re-exports the registry helpers + type for
// back-compat with existing importers (sitemap, blog category route) and exposes
// FAMILY_JOURNAL_CATEGORY for the family journal strip.

export const FAMILY_JOURNAL_CATEGORY = "family-photography";
/** The family journal archive. Public pages link it only while it has posts. */
export const FAMILY_JOURNAL_PATH = `/blog/category/${FAMILY_JOURNAL_CATEGORY}`;

export {
  BLOG_CATEGORIES,
  getBlogCategory,
  getBlogCategorySlugs,
  type BlogCategory,
} from "@/lib/blogCategories";
