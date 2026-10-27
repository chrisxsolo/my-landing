// The blog_posts columns an admin may write (pure, no I/O). The admin API and
// the revision restore both go through this list, so a request body or a
// stored snapshot can never set id, created_at or a column that does not exist.

export const EDITABLE_BLOG_POST_FIELDS = [
  "title", "body", "slug", "published_at", "category", "sites",
  "cover_image_url", "cover_image_alt", "extra_image_urls", "extra_image_alts", "og_image_url",
  "meta_description", "meta_keywords",
] as const;

export type EditableBlogPostField = (typeof EDITABLE_BLOG_POST_FIELDS)[number];

export type BlogPostUpdates = Partial<Record<EditableBlogPostField, unknown>>;

const FIELD_SET: ReadonlySet<string> = new Set(EDITABLE_BLOG_POST_FIELDS);

/** Only the editable columns of `input`, in list order; unknown keys are dropped. */
export function pickEditableFields(input: Record<string, unknown>): BlogPostUpdates {
  return Object.fromEntries(
    EDITABLE_BLOG_POST_FIELDS.filter((f) => f in input).map((f) => [f, input[f]]),
  ) as BlogPostUpdates;
}

/** Keys of `input` that are not editable columns (for a clear 400). */
export function rejectedFields(input: Record<string, unknown>): string[] {
  return Object.keys(input).filter((k) => !FIELD_SET.has(k));
}

export interface CoverState {
  cover_image_url: string | null;
  og_image_url: string | null;
}

/**
 * Keeps the social image on the cover when the cover changes: og_image_url
 * follows the new cover when it was empty or equal to the old cover, and is
 * left alone when it was set to something else on purpose or the update sets
 * it explicitly.
 */
export function withOgImageFollowingCover(current: CoverState, updates: BlogPostUpdates): BlogPostUpdates {
  if (!("cover_image_url" in updates) || "og_image_url" in updates) return updates;
  const nextCover = typeof updates.cover_image_url === "string" ? updates.cover_image_url : null;
  if (nextCover === current.cover_image_url) return updates;
  const ogFollowed = !current.og_image_url || current.og_image_url === current.cover_image_url;
  return ogFollowed ? { ...updates, og_image_url: nextCover } : updates;
}
