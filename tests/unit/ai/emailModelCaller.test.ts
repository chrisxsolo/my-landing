// ─────────────────────────────────────────────────────────────────────────────
// The one place the Anthropic SDK is called.
//
// Regression for the failure behind every "Learn from reply" attempt: the
// rule-phrasing prompt has no per-draft half, and the caller sent it as an
// empty system text block, which the API rejects with a 400. The SDK is
// mocked here, so nothing is billed.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ requests: [] as Record<string, unknown>[] }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (params: Record<string, unknown>) => {
        mocks.requests.push(params);
        return {
          content: [{ type: "text", text: "- Keep it short" }],
          model: "claude-sonnet-5-5",
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: "end_turn",
        };
      },
    };
  },
}));

const { createEmailModelCaller, systemBlocks, classifyModelError, friendlyModelError } = await import("@/lib/ai/emailModel");

beforeEach(() => { mocks.requests = []; });

describe("systemBlocks", () => {
  it("omits an empty volatile half instead of sending an empty text block", () => {
    const blocks = systemBlocks({ stable: "Rules", volatile: "" });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "text", text: "Rules", cache_control: { type: "ephemeral" } });
  });

  it("keeps both halves when both carry text", () => {
    const blocks = systemBlocks({ stable: "Rules", volatile: "Facts" });
    expect(blocks.map((b) => b.text)).toEqual(["Rules", "Facts"]);
    expect("cache_control" in blocks[1]).toBe(false);
  });
});

describe("createEmailModelCaller", () => {
  it("never sends an empty system text block to the API", async () => {
    const call = createEmailModelCaller("test-key", { model: "claude-sonnet-5-5", effort: "low", unpricedModel: false });
    const result = await call({ system: { stable: "Rules", volatile: "" }, userPrompt: "Phrase these", maxTokens: 400 });

    expect(mocks.requests).toHaveLength(1);
    const system = mocks.requests[0].system as { text: string }[];
    expect(system.every((block) => block.text.length > 0)).toBe(true);
    expect(mocks.requests[0].max_tokens).toBe(400);
    expect(result.text).toBe("- Keep it short");
  });
});

describe("classifyModelError", () => {
  it("names a malformed request so it is not reported as a transient failure", () => {
    const err = new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"system: text content blocks must be non-empty"}}');
    expect(classifyModelError(err)).toBe("invalid_request");
    expect(friendlyModelError(err, "learn")).toMatch(/malformed/);
    expect(friendlyModelError(err, "learn")).not.toMatch(/draft request failed/);
  });

  it("keeps the drafting wording for the drafting route", () => {
    expect(friendlyModelError(new Error("boom"))).toBe("The draft request failed. Your existing draft is unchanged.");
    expect(friendlyModelError(new Error("boom"), "learn")).not.toMatch(/draft/);
  });
});
