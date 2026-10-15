// ─────────────────────────────────────────────────────────────────────────────
// The single Claude call the email assistant makes.
//
// Everything about model choice lives here so there is one place to change it.
// Callers pass a prompt and get back text plus real token usage; they never
// touch the Anthropic SDK. The ModelCaller seam mirrors lib/contentEngine/
// aiClient.ts so tests inject a deterministic fake and never hit the paid API.
//
// Model default: claude-sonnet-5-5. Chosen because at $2/$10 per MTok it is
// cheaper than claude-sonnet-4-6 ($3/$15) and cheaper on output than the
// gpt-4.1 this replaced, so quality here costs less than what it replaced
// rather than more. claude-haiku-5-5 ($0.10/$0.50) is a drop-in via
// CLAUDE_EMAIL_MODEL if the bill ever matters more than the prose.
//
// Effort default: low. Email drafting is a short, tightly specified writing
// task, not a reasoning problem, and effort bills as output tokens — high
// effort would spend thinking tokens on "Hi Sarah, Friday at 5:30 pm works!".
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { isKnownEmailModel } from "./modelPricing";

export const DEFAULT_EMAIL_MODEL = "claude-sonnet-5-5";
export const DEFAULT_EMAIL_EFFORT = "low";

/** Max output tokens. One email body, with headroom for a long availability list. */
export const EMAIL_MAX_TOKENS = 900;

/** Hard ceiling on a single generation so a hung request cannot pin the route. */
export const EMAIL_TIMEOUT_MS = 45_000;

export type EmailEffort = "low" | "medium" | "high" | "max";

/** Just the shape config reading needs, so tests can pass a partial env. */
export type EnvLike = Record<string, string | undefined>;

const VALID_EFFORTS: EmailEffort[] = ["low", "medium", "high", "max"];

export type EmailModelConfig = {
  model: string;
  effort: EmailEffort;
  /** True when the configured model has no entry in the rate card. */
  unpricedModel: boolean;
};

/**
 * Reads model config from the environment, falling back to the defaults rather
 * than throwing — a typo in CLAUDE_EMAIL_MODEL should not take drafting
 * offline, but it must be visible, so an unpriced model is flagged instead of
 * silently costing an untracked amount.
 */
export function resolveEmailModelConfig(env: EnvLike = process.env): EmailModelConfig {
  const model = (env.CLAUDE_EMAIL_MODEL ?? "").trim() || DEFAULT_EMAIL_MODEL;
  const rawEffort = (env.CLAUDE_EMAIL_EFFORT ?? "").trim().toLowerCase();
  const effort = (VALID_EFFORTS as string[]).includes(rawEffort)
    ? (rawEffort as EmailEffort)
    : (DEFAULT_EMAIL_EFFORT as EmailEffort);

  return { model, effort, unpricedModel: !isKnownEmailModel(model) };
}

/** A system prompt split so the stable part can carry a cache breakpoint. */
export type SystemPrompt = {
  /** Identical across drafts: profile, rules, playbook. Cached. */
  stable: string;
  /** Varies per draft: verified facts, examples, thread digest. Not cached. */
  volatile: string;
};

export type EmailCallRequest = {
  system: SystemPrompt;
  userPrompt: string;
  maxTokens?: number;
  /**
   * Overrides the configured effort for one call. Note there is deliberately
   * no temperature knob: the SDK deprecates it, and every model after Claude
   * Opus 4.6 rejects any value but 1.0 with a 400. Consistency on this task
   * comes from low effort and an unambiguous prompt, not from sampling.
   */
  effort?: EmailEffort;
};

export type EmailCallResult = {
  text: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  /** "max_tokens" means the draft is truncated and must not be trusted. */
  stopReason: string | null;
  durationMs: number;
};

export type EmailModelCaller = (req: EmailCallRequest) => Promise<EmailCallResult>;

/**
 * Builds the real caller.
 *
 * The system prompt goes out as two blocks with a cache_control breakpoint
 * after the stable one. Both Sonnet 5.5 and Haiku 5.5 cache from 512 tokens,
 * and the stable block clears that, so a second draft within the 5-minute TTL
 * reads the prefix at 5% of input price instead of paying for it again.
 */
export function createEmailModelCaller(
  apiKey: string,
  config: EmailModelConfig,
): EmailModelCaller {
  const client = new Anthropic({ apiKey, timeout: EMAIL_TIMEOUT_MS, maxRetries: 1 });

  return async (req) => {
    const startedAt = Date.now();

    const response = await client.messages.create({
      model: config.model,
      max_tokens: req.maxTokens ?? EMAIL_MAX_TOKENS,
      output_config: { effort: req.effort ?? config.effort },
      system: [
        {
          type: "text",
          text: req.system.stable,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: req.system.volatile },
      ],
      messages: [{ role: "user", content: req.userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      },
      stopReason: response.stop_reason,
      durationMs: Date.now() - startedAt,
    };
  };
}

/** Maps SDK/API failures onto something a photographer can act on. */
export function friendlyModelError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/overloaded/i.test(message)) return "Claude is overloaded right now. Try again in a moment.";
  if (/rate.?limit|429/i.test(message)) return "Rate limit hit. Wait a few seconds and try again.";
  if (/timeout|aborted|ETIMEDOUT/i.test(message)) return "Claude took too long to respond. Your draft is unchanged.";
  if (/401|authentication|invalid.*api.?key/i.test(message)) return "The Claude API key is missing or invalid.";
  if (/credit|billing|quota/i.test(message)) return "The Claude account is out of credit.";
  return "The draft request failed. Your existing draft is unchanged.";
}
