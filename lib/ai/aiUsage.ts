// ─────────────────────────────────────────────────────────────────────────────
// Usage and cost tracking for the email assistant.
//
// Token counts come from the API response, never from an estimate of the
// prompt. Costs are computed from those counts against the rate card and are
// labelled as estimates everywhere they surface: Anthropic's invoice is the
// only authority on what was actually billed.
//
// Nothing here stores email content. A row is model, operation, token counts,
// duration and outcome — enough to answer "what is this costing me" without
// keeping a second copy of a client's private email in a metrics table.
// ─────────────────────────────────────────────────────────────────────────────

import { estimateUsageCostUsd, type TokenUsage } from "./modelPricing";
import type { EnvLike } from "./emailModel";

export const AI_USAGE_TABLE = "ai_email_usage";

export const EMAIL_OPERATIONS = [
  "generate", "refine", "polish", "shorten", "naturalize", "learn",
] as const;
export type EmailOperation = (typeof EMAIL_OPERATIONS)[number];

export type UsageRecord = {
  operation: EmailOperation;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  duration_ms: number;
  success: boolean;
  /** Short failure reason. Never the draft, never client text. */
  error_kind?: string | null;
  /** Lets the dashboard separate first attempts from regenerations. */
  is_regeneration?: boolean;
};

export const DEFAULT_MONTHLY_BUDGET_USD = 5;
export const DEFAULT_WARNING_PERCENT = 80;

export type BudgetConfig = {
  monthlyBudgetUsd: number;
  warningPercent: number;
  /** When true, a request is refused once the budget is exceeded. */
  enforceLimit: boolean;
};

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveBudgetConfig(env: EnvLike = process.env): BudgetConfig {
  return {
    monthlyBudgetUsd: positiveNumber(env.AI_EMAIL_MONTHLY_BUDGET_USD, DEFAULT_MONTHLY_BUDGET_USD),
    warningPercent: positiveNumber(env.AI_EMAIL_BUDGET_WARNING_PERCENT, DEFAULT_WARNING_PERCENT),
    enforceLimit: env.AI_EMAIL_BUDGET_ENFORCE === "true",
  };
}

export type BudgetStatus = {
  spentUsd: number;
  budgetUsd: number;
  percentUsed: number;
  state: "ok" | "warning" | "over";
  /** True when the request should be refused. */
  blocked: boolean;
  message: string | null;
};

/**
 * Compares month-to-date spend against the budget.
 *
 * A local limit cannot guarantee a maximum charge: concurrent requests, other
 * activity on the same API key, and Anthropic's own reporting delay all mean
 * the real bill can land above this figure. The wording says so.
 */
export function evaluateBudget(spentUsd: number, config: BudgetConfig): BudgetStatus {
  const percentUsed = config.monthlyBudgetUsd > 0
    ? (spentUsd / config.monthlyBudgetUsd) * 100
    : 0;

  if (percentUsed >= 100) {
    return {
      spentUsd, budgetUsd: config.monthlyBudgetUsd, percentUsed,
      state: "over",
      blocked: config.enforceLimit,
      message: config.enforceLimit
        ? `Estimated spend this month ($${spentUsd.toFixed(2)}) is over the $${config.monthlyBudgetUsd} target and the app limit is on, so drafting is paused. Raise AI_EMAIL_MONTHLY_BUDGET_USD to continue.`
        : `Estimated spend this month is $${spentUsd.toFixed(2)}, over the $${config.monthlyBudgetUsd} target. This is an estimate, not an Anthropic bill.`,
    };
  }

  if (percentUsed >= config.warningPercent) {
    return {
      spentUsd, budgetUsd: config.monthlyBudgetUsd, percentUsed,
      state: "warning", blocked: false,
      message: `Estimated spend this month is $${spentUsd.toFixed(2)}, which is ${Math.round(percentUsed)}% of the $${config.monthlyBudgetUsd} target.`,
    };
  }

  return {
    spentUsd, budgetUsd: config.monthlyBudgetUsd, percentUsed,
    state: "ok", blocked: false, message: null,
  };
}

export function estimateRecordCostUsd(record: Pick<UsageRecord, "model" | "input_tokens" | "output_tokens" | "cache_creation_input_tokens" | "cache_read_input_tokens">): number {
  return estimateUsageCostUsd([record as TokenUsage]).totalUsd;
}

export type UsageSummary = {
  month: string;
  estimatedSpendUsd: number;
  unknownModels: string[];
  draftsGenerated: number;
  regenerations: number;
  failures: number;
  avgCostPerDraftUsd: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgDurationMs: number;
  cacheHitRate: number;
  topModel: string | null;
  byOperation: Record<string, number>;
};

/** Rolls rows up for the dashboard. Pure, so it unit-tests without a database. */
export function summarizeUsage(rows: UsageRecord[], month: string): UsageSummary {
  const { totalUsd, unknownModels } = estimateUsageCostUsd(rows as TokenUsage[]);

  const generations = rows.filter((row) => row.operation === "generate");
  const regenerations = generations.filter((row) => row.is_regeneration).length;
  const failures = rows.filter((row) => !row.success).length;

  const modelCounts = new Map<string, number>();
  const byOperation: Record<string, number> = {};
  let cacheReads = 0;

  for (const row of rows) {
    modelCounts.set(row.model, (modelCounts.get(row.model) ?? 0) + 1);
    byOperation[row.operation] = (byOperation[row.operation] ?? 0) + 1;
    if (row.cache_read_input_tokens > 0) cacheReads += 1;
  }

  const topModel = [...modelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mean = (pick: (row: UsageRecord) => number) =>
    rows.length ? rows.reduce((sum, row) => sum + pick(row), 0) / rows.length : 0;

  return {
    month,
    estimatedSpendUsd: totalUsd,
    unknownModels,
    draftsGenerated: generations.length,
    regenerations,
    failures,
    avgCostPerDraftUsd: generations.length ? totalUsd / generations.length : 0,
    avgInputTokens: mean((row) => row.input_tokens + row.cache_read_input_tokens + row.cache_creation_input_tokens),
    avgOutputTokens: mean((row) => row.output_tokens),
    avgDurationMs: mean((row) => row.duration_ms),
    cacheHitRate: rows.length ? cacheReads / rows.length : 0,
    topModel,
    byOperation,
  };
}

/** First day of the current month as "YYYY-MM-01", for the spend query. */
export function currentMonthStart(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function currentMonthLabel(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
