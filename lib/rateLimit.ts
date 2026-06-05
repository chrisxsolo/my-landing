// ─────────────────────────────────────────────────────────────────────────────
// lib/rateLimit.ts
//
// Tiny in-memory fixed-window rate limiter for API route handlers.
//
// NOTE: state lives in the serverless instance's memory, so it is NOT shared
// across instances and resets on cold start. It reliably stops bursts from a
// single client hitting one instance, but is best-effort across the fleet —
// pair it with a durable check (e.g. a Supabase lookup) for hard guarantees.
// ─────────────────────────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded over a long-lived
  // instance. Cheap because it only runs once the map is sizeable.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now > b.resetAt) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}
