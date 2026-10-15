// ─────────────────────────────────────────────────────────────────────────────
// Supabase access for the email assistant.
//
// Every read is wrapped so a database hiccup degrades the draft instead of
// failing it: missing rules mean the permanent profile alone, missing examples
// mean the seeded ones. A usage write that fails is logged and swallowed — a
// metrics insert must never lose Chris a draft he already paid for.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { normalizeRule, type WritingRule, type RuleCategory, type RuleStatus } from "./writingRules";
import { SEED_EXAMPLES, type ApprovedExample, type ExampleScenario } from "./approvedExamples";
import {
  AI_USAGE_TABLE, currentMonthStart, estimateRecordCostUsd,
  type UsageRecord,
} from "./aiUsage";
import { estimateUsageCostUsd, type TokenUsage } from "./modelPricing";

const RULES_TABLE = "ai_writing_rules";
const EXAMPLES_TABLE = "ai_approved_examples";

type RuleRow = {
  id: string; rule: string; category: RuleCategory; status: RuleStatus;
  source: string; created_at: string; superseded_by: string | null;
};

function toWritingRule(row: RuleRow): WritingRule {
  return {
    id: row.id, rule: row.rule, category: row.category, status: row.status,
    source: row.source, createdAt: row.created_at, supersededBy: row.superseded_by,
  };
}

export async function fetchWritingRules(): Promise<WritingRule[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(RULES_TABLE)
      .select("id, rule, category, status, source, created_at, superseded_by")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => toWritingRule(row as RuleRow));
  } catch (err) {
    // A draft written from the permanent profile alone is still a good draft.
    console.error("[aiEmailStore] fetchWritingRules failed, continuing without learned rules:", err);
    return [];
  }
}

export async function insertWritingRule(input: {
  rule: string;
  category: RuleCategory;
  status: RuleStatus;
  source: string;
}): Promise<WritingRule | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(RULES_TABLE)
      .insert({
        rule: input.rule.trim(),
        category: input.category,
        status: input.status,
        source: input.source,
        rule_key: normalizeRule(input.rule),
        approved_at: input.status === "approved" ? new Date().toISOString() : null,
      })
      .select("id, rule, category, status, source, created_at, superseded_by")
      .single();
    if (error) throw error;
    return toWritingRule(data as RuleRow);
  } catch (err) {
    console.error("[aiEmailStore] insertWritingRule failed:", err);
    return null;
  }
}

export async function setRuleStatus(
  id: string,
  status: RuleStatus,
  supersededBy: string | null = null,
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from(RULES_TABLE)
      .update({
        status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        superseded_by: supersededBy,
      })
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[aiEmailStore] setRuleStatus failed:", err);
    return false;
  }
}

type ExampleRow = {
  id: string; body: string; session_type: string | null;
  scenarios: string[]; tags: string[];
};

/**
 * Seeded examples plus Chris's approved ones. Seeds come first so the pool is
 * never empty and example selection stays deterministic when the table is.
 */
export async function fetchExamplePool(): Promise<ApprovedExample[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(EXAMPLES_TABLE)
      .select("id, body, session_type, scenarios, tags")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;

    const approved: ApprovedExample[] = (data ?? []).map((raw) => {
      const row = raw as ExampleRow;
      return {
        id: row.id,
        sessionTypes: row.session_type ? [row.session_type] : [],
        scenarios: (row.scenarios ?? []) as ExampleScenario[],
        tags: row.tags ?? [],
        body: row.body,
        source: "approved-draft" as const,
      };
    });
    return [...SEED_EXAMPLES, ...approved];
  } catch (err) {
    console.error("[aiEmailStore] fetchExamplePool failed, using seed examples:", err);
    return SEED_EXAMPLES;
  }
}

export async function insertApprovedExample(input: {
  body: string;
  sessionType: string | null;
  scenarios: string[];
  tags: string[];
  sourceInquiryId?: string | null;
}): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from(EXAMPLES_TABLE).insert({
      body: input.body.trim(),
      session_type: input.sessionType,
      scenarios: input.scenarios,
      tags: input.tags,
      source_inquiry_id: input.sourceInquiryId ?? null,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[aiEmailStore] insertApprovedExample failed:", err);
    return false;
  }
}

/** Fire-and-forget usage write. Never throws into the request path. */
export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from(AI_USAGE_TABLE).insert({
      operation: record.operation,
      model: record.model,
      input_tokens: record.input_tokens,
      output_tokens: record.output_tokens,
      cache_creation_input_tokens: record.cache_creation_input_tokens,
      cache_read_input_tokens: record.cache_read_input_tokens,
      duration_ms: record.duration_ms,
      success: record.success,
      error_kind: record.error_kind ?? null,
      is_regeneration: record.is_regeneration ?? false,
    });
    if (error) throw error;
  } catch (err) {
    console.error("[aiEmailStore] recordUsage failed:", err);
  }
}

export async function fetchMonthToDateUsage(now: Date = new Date()): Promise<UsageRecord[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from(AI_USAGE_TABLE)
      .select("operation, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, duration_ms, success, error_kind, is_regeneration")
      .gte("created_at", `${currentMonthStart(now)}T00:00:00Z`);
    if (error) throw error;
    return (data ?? []) as UsageRecord[];
  } catch (err) {
    console.error("[aiEmailStore] fetchMonthToDateUsage failed:", err);
    return [];
  }
}

/**
 * Month-to-date estimated spend.
 *
 * Returns 0 when the table cannot be read. That fails open on purpose: a
 * budget check that cannot see spend must not be the thing that blocks a draft.
 */
export async function fetchMonthToDateSpendUsd(now: Date = new Date()): Promise<number> {
  const rows = await fetchMonthToDateUsage(now);
  return estimateUsageCostUsd(rows as TokenUsage[]).totalUsd;
}

export { estimateRecordCostUsd };
