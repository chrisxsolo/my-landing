// Public-cache refresh with an OBSERVABLE outcome, for the publication worker.
// lib/publicRevalidation.ts swallows errors on purpose (its callers already
// wrote the row and hourly ISR is their backstop); the worker instead records a
// failed refresh as "published, refresh pending" and retries it on later
// ticks, so it needs to know. Next's revalidate calls mark paths for refresh on
// their next visit — a success here means "marked", never "fresh page served".
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";

export interface RefreshResult {
  ok: boolean;
  refreshed: string[];
  failed: string[];
  error: string | null;
}

/** Marker for "revalidate every /blog/category/<slug> page" (a dynamic segment needs the pattern form). */
export const BLOG_CATEGORY_PATTERN = "/blog/category/[category]";

/** Every public surface a new blog post appears on. */
export function publicPathsForBlogPost(slug: string): string[] {
  return ["/blog", `/blog/${slug}`, BLOG_CATEGORY_PATTERN, "/sitemap.xml"];
}

/** Per-path marker for the publishers' `revalidate` callback: busts the tag, handles patterns, throws on failure. */
export function revalidateOnePath(path: string, fns: RevalidateFns = realFns): void {
  const result = refreshPublicPaths([path], fns);
  if (!result.ok) throw new Error(result.error ?? `refresh failed for ${path}`);
}

export type RevalidateFns = {
  tag: (tag: string, profile: { expire: number }) => void;
  path: (path: string, type?: "page" | "layout") => void;
};

const realFns: RevalidateFns = {
  tag: (tag, profile) => revalidateTag(tag, profile),
  path: (path, type) => (type ? revalidatePath(path, type) : revalidatePath(path)),
};

/**
 * Busts the shared public-content data cache, then marks each path. Never
 * throws; the caller decides what a partial failure means. `fns` is
 * injectable so tests can make a path fail.
 */
export function refreshPublicPaths(paths: readonly string[], fns: RevalidateFns = realFns): RefreshResult {
  const refreshed: string[] = [];
  const failed: string[] = [];
  let error: string | null = null;
  try {
    fns.tag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
  } catch (err) {
    error = `tag: ${err instanceof Error ? err.message : String(err)}`;
    // The data cache still holds the old reads: every page needs another try.
    return { ok: false, refreshed, failed: [...paths], error };
  }
  for (const path of paths) {
    try {
      if (path.includes("[")) fns.path(path, "page");
      else fns.path(path);
      refreshed.push(path);
    } catch (err) {
      failed.push(path);
      error = error ?? `${path}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return { ok: failed.length === 0, refreshed, failed, error };
}
