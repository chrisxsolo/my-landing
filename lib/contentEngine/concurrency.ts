// Bounded-concurrency mapping for admin batch work (photo uploads, analysis
// batches). Results keep input order; the worker owns its own error handling —
// a rejection from the worker rejects the whole map.
// Keep this module dependency-free: client components import it.

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const lanes = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}
