import { describe, it, expect } from "vitest";
import { estimateUsageCostUsd, EMAIL_MODEL_RATES, isKnownEmailModel } from "@/lib/ai/modelPricing";
import {
  evaluateBudget, resolveBudgetConfig, summarizeUsage, currentMonthStart,
  currentMonthLabel, type UsageRecord,
} from "@/lib/ai/aiUsage";
import { resolveEmailModelConfig, DEFAULT_EMAIL_MODEL } from "@/lib/ai/emailModel";
import { dedupe, dedupKey } from "@/lib/ai/requestDedup";

function usage(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    operation: "generate", model: "claude-sonnet-5-5",
    input_tokens: 1000, output_tokens: 200,
    cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    duration_ms: 1500, success: true, ...overrides,
  };
}

describe("rate card", () => {
  it("prices Sonnet 5.5 at the verified published rate", () => {
    expect(EMAIL_MODEL_RATES["claude-sonnet-5-5"]).toEqual({
      inputPerMTokUsd: 2, outputPerMTokUsd: 10,
      cacheWritePerMTokUsd: 2.5, cacheReadPerMTokUsd: 0.1,
    });
  });

  it("computes cost from token counts across all four columns", () => {
    const { totalUsd } = estimateUsageCostUsd([{
      model: "claude-sonnet-5-5",
      input_tokens: 1_000_000, output_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000,
    }]);
    expect(totalUsd).toBeCloseTo(2 + 10 + 2.5 + 0.1, 6);
  });

  it("surfaces an unknown model instead of guessing a price", () => {
    const { totalUsd, unknownModels } = estimateUsageCostUsd([
      { model: "some-future-model", input_tokens: 1_000_000, output_tokens: 1_000_000 },
    ]);
    expect(totalUsd).toBe(0);
    expect(unknownModels).toEqual(["some-future-model"]);
    expect(isKnownEmailModel("some-future-model")).toBe(false);
  });

  it("makes a cache read an order of magnitude cheaper than fresh input", () => {
    const fresh = estimateUsageCostUsd([{ model: "claude-sonnet-5-5", input_tokens: 100_000, output_tokens: 0 }]).totalUsd;
    const cached = estimateUsageCostUsd([{ model: "claude-sonnet-5-5", input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 100_000 }]).totalUsd;
    expect(cached).toBeCloseTo(fresh / 20, 6);
  });
});

describe("cost per draft", () => {
  // Token counts measured with Anthropic's count_tokens endpoint against a
  // real assembled prompt (Berkeley graduation inquiry, 3-message thread):
  // 1,049-token cacheable prefix, 1,664 tokens of per-draft facts and thread,
  // ~220 tokens of email out.
  const CACHED_PREFIX = 1049;
  const PER_DRAFT_INPUT = 1664;
  const OUTPUT = 220;

  /** Second and later drafts inside the 5-minute cache window. */
  const cacheHit = {
    model: "claude-sonnet-5-5",
    input_tokens: PER_DRAFT_INPUT, output_tokens: OUTPUT,
    cache_creation_input_tokens: 0, cache_read_input_tokens: CACHED_PREFIX,
  };

  /** First draft of a session, which pays to write the cache. */
  const cacheWrite = {
    model: "claude-sonnet-5-5",
    input_tokens: PER_DRAFT_INPUT, output_tokens: OUTPUT,
    cache_creation_input_tokens: CACHED_PREFIX, cache_read_input_tokens: 0,
  };

  it("costs about half a cent on a cache hit", () => {
    expect(estimateUsageCostUsd([cacheHit]).totalUsd).toBeCloseTo(0.00563, 5);
  });

  it("costs under a cent even when it pays to write the cache", () => {
    expect(estimateUsageCostUsd([cacheWrite]).totalUsd).toBeCloseTo(0.00815, 5);
  });

  it("stays inside a $5 month at 500 drafts, worst case", () => {
    // Every draft paying cache-write: 500 × $0.00815 ≈ $4.08. The target holds
    // without relying on cache hits at all.
    const monthly = estimateUsageCostUsd(Array.from({ length: 500 }, () => cacheWrite)).totalUsd;
    expect(monthly).toBeLessThan(5);
  });

  it("would have blown the budget at the old prompt size", () => {
    // The previous pipeline inlined 47 vault notes: 25,778 tokens per draft,
    // measured. Priced at the same rates, 100 emails a month exceeds $5 on
    // prompt size alone — which is why trimming the prompt, not switching
    // model, is what made the target reachable.
    const oldShape = {
      model: "claude-sonnet-5-5",
      input_tokens: 25_778, output_tokens: 600,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    };
    const monthly = estimateUsageCostUsd(Array.from({ length: 100 }, () => oldShape)).totalUsd;
    expect(monthly).toBeGreaterThan(5);
  });

  it("is an order of magnitude cheaper on Haiku 5.5, the configurable fallback", () => {
    const sonnet = estimateUsageCostUsd([cacheHit]).totalUsd;
    const haiku = estimateUsageCostUsd([{ ...cacheHit, model: "claude-haiku-5-5" }]).totalUsd;
    expect(haiku).toBeLessThan(sonnet / 10);
  });
});

describe("model config", () => {
  it("defaults to Sonnet 5.5 at low effort", () => {
    const config = resolveEmailModelConfig({});
    expect(config).toEqual({ model: DEFAULT_EMAIL_MODEL, effort: "low", unpricedModel: false });
  });

  it("honours CLAUDE_EMAIL_MODEL and CLAUDE_EMAIL_EFFORT", () => {
    const config = resolveEmailModelConfig({
      CLAUDE_EMAIL_MODEL: "claude-haiku-5-5", CLAUDE_EMAIL_EFFORT: "medium",
    });
    expect(config.model).toBe("claude-haiku-5-5");
    expect(config.effort).toBe("medium");
  });

  it("flags a model with no rate card entry rather than failing closed", () => {
    const config = resolveEmailModelConfig({ CLAUDE_EMAIL_MODEL: "typo-model" });
    expect(config.model).toBe("typo-model");
    expect(config.unpricedModel).toBe(true);
  });

  it("falls back to the default effort on an invalid value", () => {
    expect(resolveEmailModelConfig({ CLAUDE_EMAIL_EFFORT: "turbo" }).effort).toBe("low");
  });
});

describe("budget", () => {
  const config = { monthlyBudgetUsd: 5, warningPercent: 80, enforceLimit: false };

  it("stays quiet below the warning line", () => {
    const status = evaluateBudget(1.0, config);
    expect(status.state).toBe("ok");
    expect(status.message).toBeNull();
  });

  it("warns at the configured percentage", () => {
    const status = evaluateBudget(4.0, config);
    expect(status.state).toBe("warning");
    expect(status.message).toMatch(/80%/);
  });

  it("reports going over without blocking when the limit is off", () => {
    const status = evaluateBudget(6.0, config);
    expect(status.state).toBe("over");
    expect(status.blocked).toBe(false);
    expect(status.message).toMatch(/estimate, not an Anthropic bill/i);
  });

  it("blocks only when the app limit is explicitly enabled", () => {
    expect(evaluateBudget(6.0, { ...config, enforceLimit: true }).blocked).toBe(true);
  });

  it("reads its defaults from the environment", () => {
    expect(resolveBudgetConfig({}))
      .toEqual({ monthlyBudgetUsd: 5, warningPercent: 80, enforceLimit: false });
    expect(resolveBudgetConfig({
      AI_EMAIL_MONTHLY_BUDGET_USD: "12", AI_EMAIL_BUDGET_WARNING_PERCENT: "50",
      AI_EMAIL_BUDGET_ENFORCE: "true",
    })).toEqual({ monthlyBudgetUsd: 12, warningPercent: 50, enforceLimit: true });
  });
});

describe("usage summary", () => {
  it("separates first drafts from regenerations", () => {
    const summary = summarizeUsage([
      usage(), usage({ is_regeneration: true }), usage({ operation: "polish" }),
    ], "2026-10");
    expect(summary.draftsGenerated).toBe(2);
    expect(summary.regenerations).toBe(1);
    expect(summary.byOperation).toEqual({ generate: 2, polish: 1 });
  });

  it("counts failures and reports the cache hit rate", () => {
    const summary = summarizeUsage([
      usage({ cache_read_input_tokens: 1500 }),
      usage({ success: false, error_kind: "timeout" }),
    ], "2026-10");
    expect(summary.failures).toBe(1);
    expect(summary.cacheHitRate).toBe(0.5);
  });

  it("handles an empty month without dividing by zero", () => {
    const summary = summarizeUsage([], "2026-10");
    expect(summary.avgCostPerDraftUsd).toBe(0);
    expect(summary.avgInputTokens).toBe(0);
    expect(summary.topModel).toBeNull();
  });
});

describe("month boundaries", () => {
  it("anchors the spend query to the first of the month", () => {
    expect(currentMonthStart(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-01");
    expect(currentMonthLabel(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01");
  });
});

describe("request dedup", () => {
  it("joins an identical in-flight request instead of starting a second", async () => {
    const key = dedupKey(["generate", "sarah@example.com", "hello"]);
    let runs = 0;
    const work = async () => { runs += 1; await new Promise((r) => setTimeout(r, 10)); return runs; };

    const [a, b] = await Promise.all([dedupe(key, work), dedupe(key, work)]);
    expect(runs).toBe(1);
    expect(a).toBe(b);
  });

  it("treats a different payload as a different request", async () => {
    let runs = 0;
    const work = async () => { runs += 1; return runs; };
    await Promise.all([
      dedupe(dedupKey(["generate", "a"]), work),
      dedupe(dedupKey(["generate", "b"]), work),
    ]);
    expect(runs).toBe(2);
  });

  it("clears on settle so a failure is immediately retryable", async () => {
    const key = dedupKey(["generate", "fails"]);
    await expect(dedupe(key, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(dedupe(key, async () => "second attempt")).resolves.toBe("second attempt");
  });
});
