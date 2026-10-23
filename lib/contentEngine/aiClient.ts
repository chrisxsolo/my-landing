// Thin seam over the Anthropic SDK so services accept an injected ModelCaller
// and integration tests run with a deterministic fake (never the real API).
import Anthropic from "@anthropic-ai/sdk";

// spec §8.3: claude-sonnet-4-6 is the engine default for analysis + generation,
// recorded per call, overridable via generation_settings.overrides.model_name.
export const DEFAULT_ENGINE_MODEL = "claude-sonnet-4-6";

export interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ModelCallRequest {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  /** Per-request timeout; the SDK default (10 min) outlives any serverless invocation. */
  timeoutMs?: number;
  /** SDK-level retries. Callers that retry themselves (with a deadline) pass 0. */
  maxRetries?: number;
}

export interface ModelCallResult {
  text: string;
  usage: ModelUsage;
  model: string;
}

export type ModelCaller = (req: ModelCallRequest) => Promise<ModelCallResult>;

// The SDK validates a `timeout` key even when its value is undefined, so only
// keys that are set are passed.
function requestOptions(req: ModelCallRequest): Anthropic.RequestOptions {
  const options: Anthropic.RequestOptions = {};
  if (req.timeoutMs !== undefined) options.timeout = Math.max(1, Math.floor(req.timeoutMs));
  if (req.maxRetries !== undefined) options.maxRetries = req.maxRetries;
  return options;
}

export function createAnthropicCaller(apiKey: string): ModelCaller {
  const client = new Anthropic({ apiKey });
  return async (req) => {
    const response = await client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
    }, requestOptions(req));
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  };
}
