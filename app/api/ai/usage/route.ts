// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/usage — month-to-date Claude usage for the email assistant.
//
// Costs here are estimates computed from API-reported token counts against
// lib/ai/modelPricing.ts. They are not Anthropic billing figures, and the
// response says so in a field so the UI cannot present them as a bill.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchMonthToDateUsage } from "@/lib/ai/aiEmailStore";
import {
  summarizeUsage, evaluateBudget, resolveBudgetConfig, currentMonthLabel,
} from "@/lib/ai/aiUsage";
import { resolveEmailModelConfig } from "@/lib/ai/emailModel";
import { estimateUsageCostUsd, type TokenUsage } from "@/lib/ai/modelPricing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const now = new Date();
  const rows = await fetchMonthToDateUsage(now);
  const summary = summarizeUsage(rows, currentMonthLabel(now));
  const budgetConfig = resolveBudgetConfig();
  const modelConfig = resolveEmailModelConfig();

  return NextResponse.json({
    summary,
    budget: evaluateBudget(estimateUsageCostUsd(rows as TokenUsage[]).totalUsd, budgetConfig),
    config: {
      model: modelConfig.model,
      effort: modelConfig.effort,
      unpricedModel: modelConfig.unpricedModel,
      monthlyBudgetUsd: budgetConfig.monthlyBudgetUsd,
      warningPercent: budgetConfig.warningPercent,
      enforceLimit: budgetConfig.enforceLimit,
    },
    disclaimer:
      "Costs are estimates from API-reported token counts, not Anthropic billing. Concurrent requests, other usage on the same key, and reporting delays all mean the real invoice can differ.",
  });
}
