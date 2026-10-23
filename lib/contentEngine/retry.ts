// Retry with jittered exponential backoff, bounded by an optional deadline so
// a retry never outlives the serverless invocation (or photo lease) that
// started it. Dependency-free: the browser upload path uses it too. What
// counts as retryable is always the caller's call — see modelRetry.ts for
// model API errors.

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Jittered exponential delay before retry number `attempt` (1-based). */
export function backoffDelayMs(
  attempt: number, policy: RetryPolicy, random: () => number = Math.random,
): number {
  const backoff = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return backoff * (0.5 + random() * 0.5);
}

export interface RetryOptions {
  policy: RetryPolicy;
  isRetryable: (err: unknown) => boolean;
  /** Overrides the backoff delay (e.g. to honor a server's retry-after). */
  delayFor?: (err: unknown, attempt: number) => number;
  /** Epoch ms. No retry starts if its wait would end past this. */
  deadlineAt?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>, options: RetryOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? realSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= options.policy.attempts || !options.isRetryable(err)) throw err;
      const delay = options.delayFor?.(err, attempt) ?? backoffDelayMs(attempt, options.policy);
      if (options.deadlineAt !== undefined && now() + delay >= options.deadlineAt) throw err;
      await sleep(delay);
    }
  }
}
