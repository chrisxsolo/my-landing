// ─────────────────────────────────────────────────────────────────────────────
// In-process guard against duplicate generations.
//
// A double-click, a React remount, or an impatient second press used to cost a
// second full request. This returns the first in-flight promise for an
// identical payload instead of starting another one.
//
// Scope is honest: one server instance, in memory. On Vercel a second request
// routed to a different instance is not caught, so the client keeps its own
// loading guard. This removes the common case cheaply, nothing more.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";

const IN_FLIGHT_TTL_MS = 30_000;

type Entry = { promise: Promise<unknown>; startedAt: number };

const inFlight = new Map<string, Entry>();

export function dedupKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

function evictStale(now: number): void {
  for (const [key, entry] of inFlight) {
    if (now - entry.startedAt > IN_FLIGHT_TTL_MS) inFlight.delete(key);
  }
}

/**
 * Runs `work`, or joins an identical call already running.
 *
 * The entry is cleared on settle, so a failure is retryable immediately rather
 * than being pinned for the whole TTL.
 */
export async function dedupe<T>(key: string, work: () => Promise<T>): Promise<T> {
  const now = Date.now();
  evictStale(now);

  const existing = inFlight.get(key);
  if (existing) return existing.promise as Promise<T>;

  const promise = work().finally(() => inFlight.delete(key));
  inFlight.set(key, { promise, startedAt: now });
  return promise;
}
