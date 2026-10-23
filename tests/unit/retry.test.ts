import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { backoffDelayMs, withRetries } from "@/lib/contentEngine/retry";
import { ANALYSIS_RETRY, isTransientModelError, modelRetryDelayMs } from "@/lib/contentEngine/modelRetry";

const policy = { attempts: 3, baseDelayMs: 100, maxDelayMs: 1000 };
const noSleep = async () => {};

function apiError(status: number, headers: Record<string, string> = {}) {
  return Anthropic.APIError.generate(status, { error: { message: "x" } }, "x", new Headers(headers));
}

describe("withRetries", () => {
  it("retries a retryable failure and returns the eventual success", async () => {
    let calls = 0;
    const value = await withRetries(async () => {
      calls += 1;
      if (calls < 3) throw new Error("blip");
      return "ok";
    }, { policy, isRetryable: () => true, sleep: noSleep });
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after the policy's attempts", async () => {
    let calls = 0;
    await expect(withRetries(async () => { calls += 1; throw new Error("down"); },
      { policy, isRetryable: () => true, sleep: noSleep })).rejects.toThrow("down");
    expect(calls).toBe(3);
  });

  it("never retries a non-retryable failure", async () => {
    let calls = 0;
    await expect(withRetries(async () => { calls += 1; throw new Error("bad request"); },
      { policy, isRetryable: () => false, sleep: noSleep })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("does not start a retry whose wait would cross the deadline", async () => {
    let calls = 0;
    await expect(withRetries(async () => { calls += 1; throw new Error("slow"); }, {
      policy, isRetryable: () => true, sleep: noSleep,
      now: () => 1_000, deadlineAt: 1_010, delayFor: () => 50,
    })).rejects.toThrow("slow");
    expect(calls).toBe(1);
  });

  it("backs off exponentially within the cap", () => {
    expect(backoffDelayMs(1, policy, () => 1)).toBe(100);
    expect(backoffDelayMs(2, policy, () => 1)).toBe(200);
    expect(backoffDelayMs(9, policy, () => 1)).toBe(1000);
    expect(backoffDelayMs(1, policy, () => 0)).toBe(50); // jitter floor is half
  });
});

describe("model error classification", () => {
  it("retries rate limits, overload, 5xx and dropped connections", () => {
    for (const status of [429, 500, 503, 529]) expect(isTransientModelError(apiError(status))).toBe(true);
    expect(isTransientModelError(new Anthropic.APIConnectionError({ message: "reset" }))).toBe(true);
    expect(isTransientModelError(new Anthropic.APIConnectionTimeoutError())).toBe(true);
  });

  it("fails fast on requests a retry cannot fix", () => {
    for (const status of [400, 401, 403, 404]) expect(isTransientModelError(apiError(status))).toBe(false);
    expect(isTransientModelError(new Error("plain"))).toBe(false);
  });

  it("honors retry-after when it is longer than the backoff", () => {
    expect(modelRetryDelayMs(apiError(429, { "retry-after": "7" }), 1, ANALYSIS_RETRY, () => 1)).toBe(7000);
    expect(modelRetryDelayMs(apiError(529), 1, ANALYSIS_RETRY, () => 1)).toBe(ANALYSIS_RETRY.baseDelayMs);
  });
});
