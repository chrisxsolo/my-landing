import { unstable_cache } from "next/cache";

// Shared data-cache tag for every Supabase read that feeds the public site.
// Admin mutations bust it via revalidateTag(PUBLIC_CONTENT_CACHE_TAG) in
// /api/admin/revalidate, so cached reads stay fresh after edits while public
// traffic stops paying a Supabase round-trip per request.
export const PUBLIC_CONTENT_CACHE_TAG = "public-content";

const PUBLIC_CONTENT_REVALIDATE_SECONDS = 3600;

// Wraps a public-content read in Next's data cache. Key = keyParts + the
// serialized call arguments, so parameterized reads (per-slug, per-category)
// cache independently. Only use for reads that admin routes never depend on
// for fresh-after-write data.
export function cachePublicContent<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, keyParts, {
    tags: [PUBLIC_CONTENT_CACHE_TAG],
    revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
  });
}
