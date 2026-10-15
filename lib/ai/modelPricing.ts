// ─────────────────────────────────────────────────────────────────────────────
// Cache-aware Claude rate card for the email assistant.
//
// lib/contentEngine/aiPricing.ts covers the content engine and has no notion of
// cache tokens; the email assistant caches its prompt prefix, so it needs the
// cache-write and cache-read columns too. Rates are per million tokens.
//
// Verified against https://platform.claude.com/docs/en/about-claude/pricing
// on 2026-10-14. Unknown models are surfaced as unknown, never guessed — an
// unpriced model yields a cost of 0 and a name in `unknownModels`, so the
// dashboard can say "can't price this" instead of quietly under-reporting.
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelRate {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  /** 5-minute ephemeral cache write. */
  cacheWritePerMTokUsd: number;
  cacheReadPerMTokUsd: number;
}

export const EMAIL_MODEL_RATES: Record<string, ModelRate> = {
  "claude-sonnet-5-5": {
    inputPerMTokUsd: 2, outputPerMTokUsd: 10,
    cacheWritePerMTokUsd: 2.5, cacheReadPerMTokUsd: 0.1,
  },
  "claude-sonnet-5": {
    inputPerMTokUsd: 2, outputPerMTokUsd: 10,
    cacheWritePerMTokUsd: 2.5, cacheReadPerMTokUsd: 0.2,
  },
  // Haiku 5.5 is cheapest for prompts under 100k tokens. The email assistant's
  // prompts are ~3k, so the long-context tier never applies here.
  "claude-haiku-5-5": {
    inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.5,
    cacheWritePerMTokUsd: 0.125, cacheReadPerMTokUsd: 0.01,
  },
  "claude-haiku-4-5": {
    inputPerMTokUsd: 1, outputPerMTokUsd: 5,
    cacheWritePerMTokUsd: 1.25, cacheReadPerMTokUsd: 0.1,
  },
  "claude-opus-5-5": {
    inputPerMTokUsd: 4, outputPerMTokUsd: 20,
    cacheWritePerMTokUsd: 5, cacheReadPerMTokUsd: 0.2,
  },
  "claude-sonnet-4-6": {
    inputPerMTokUsd: 3, outputPerMTokUsd: 15,
    cacheWritePerMTokUsd: 3.75, cacheReadPerMTokUsd: 0.3,
  },
};

export interface TokenUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface CostEstimate {
  /** Always an estimate computed from API-reported tokens, never a bill. */
  totalUsd: number;
  unknownModels: string[];
}

export function estimateUsageCostUsd(usages: TokenUsage[]): CostEstimate {
  let totalUsd = 0;
  const unknown = new Set<string>();

  for (const usage of usages) {
    const rate = EMAIL_MODEL_RATES[usage.model];
    if (!rate) {
      unknown.add(usage.model);
      continue;
    }
    totalUsd +=
      (usage.input_tokens / 1e6) * rate.inputPerMTokUsd +
      (usage.output_tokens / 1e6) * rate.outputPerMTokUsd +
      ((usage.cache_creation_input_tokens ?? 0) / 1e6) * rate.cacheWritePerMTokUsd +
      ((usage.cache_read_input_tokens ?? 0) / 1e6) * rate.cacheReadPerMTokUsd;
  }

  return { totalUsd, unknownModels: [...unknown] };
}

export function isKnownEmailModel(model: string): boolean {
  return model in EMAIL_MODEL_RATES;
}
