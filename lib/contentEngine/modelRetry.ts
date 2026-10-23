// Which model API failures are worth another try, and how long to wait.
// Only failures a second try can fix are retried: connection drops and
// timeouts, rate limits (429, honoring retry-after), overload (529) and 5xx.
// A 400 or 401 fails at once. The loop itself lives in retry.ts.
import Anthropic from "@anthropic-ai/sdk";
import { backoffDelayMs, type RetryPolicy } from "@/lib/contentEngine/retry";

export const ANALYSIS_RETRY: RetryPolicy = { attempts: 3, baseDelayMs: 1_000, maxDelayMs: 8_000 };

const TRANSIENT_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export function isTransientModelError(err: unknown): boolean {
  // APIConnectionError (and its timeout subclass) carries no status.
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError) {
    return err.status !== undefined && TRANSIENT_STATUS.has(err.status);
  }
  return false;
}

function retryAfterMs(err: unknown): number | null {
  if (!(err instanceof Anthropic.APIError)) return null;
  const header = err.headers?.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/** Backoff for a model retry, never shorter than the server's retry-after. */
export function modelRetryDelayMs(
  err: unknown, attempt: number, policy: RetryPolicy = ANALYSIS_RETRY,
  random: () => number = Math.random,
): number {
  return Math.max(retryAfterMs(err) ?? 0, backoffDelayMs(attempt, policy, random));
}
