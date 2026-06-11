// Maintained per-model rate map (spec §11). Cost figures are ALWAYS estimates
// computed from actual recorded token usage — never from fabricated counts.
// Update rates from https://docs.claude.com/en/docs/about-claude/pricing when
// they change; unknown models are surfaced, never guessed.
export interface ModelRate {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

// Verified against the Claude pricing docs on 2026-06-11 (Task 3 Step 1).
export const AI_RATE_MAP: Record<string, ModelRate> = {
  "claude-sonnet-4-6": { inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
  "claude-haiku-4-5": { inputPerMTokUsd: 1, outputPerMTokUsd: 5 },
  "claude-opus-4-7": { inputPerMTokUsd: 5, outputPerMTokUsd: 25 },
};

export interface UsageEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export interface CostEstimate {
  totalUsd: number;
  unknownModels: string[];
}

export function estimateCostUsd(usages: UsageEntry[]): CostEstimate {
  let totalUsd = 0;
  const unknown = new Set<string>();
  for (const u of usages) {
    const rate = AI_RATE_MAP[u.model];
    if (!rate) {
      unknown.add(u.model);
      continue;
    }
    totalUsd += (u.input_tokens / 1_000_000) * rate.inputPerMTokUsd
              + (u.output_tokens / 1_000_000) * rate.outputPerMTokUsd;
  }
  return { totalUsd, unknownModels: [...unknown] };
}
