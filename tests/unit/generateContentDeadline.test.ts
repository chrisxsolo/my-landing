// The generation service against an injected deadline and a fake model: the
// model call is bounded inside the function budget, a provider timeout is
// caught, recorded as `failed` with the lease cleared, and reported as a
// retryable structured error — never left `processing` for Vercel to kill
// (the 2026-11-03 guide-photo 504).
import { describe, it, expect, vi, beforeEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { ModelCallRequest, ModelCaller } from "@/lib/contentEngine/aiClient";
import { GENERATION_DEADLINE_MS, GENERATION_LEASE_SECONDS, MIN_MODEL_CALL_MS } from "@/lib/contentEngine/generationBudget";

const PACKAGE = "22222222-2222-4222-8222-222222222222";
const SESSION = "11111111-1111-4111-8111-111111111111";

// A fake target that makes one JSON model call through the shared seam, so the
// timeout plumbing under test is the real one (callForJson → ModelCaller).
vi.mock("@/lib/contentEngine/generationTargets", async () => {
  const core = await vi.importActual<typeof import("@/lib/contentEngine/generationTargetCore")>(
    "@/lib/contentEngine/generationTargetCore",
  );
  return {
    GenerationError: core.GenerationError,
    GENERATION_TARGETS: {
      internal_link_suggestion: async (ctx: Parameters<typeof core.callForJson>[0]) => {
        const { usage } = await core.callForJson(ctx, { system: "s", userText: "u" });
        return { outcome: "completed", itemSpecs: [], usage };
      },
    },
  };
});

const { generateContentType } = await import("@/lib/contentEngine/generateContent");

interface RpcCall { name: string; params: Record<string, unknown> }

function fakeClient(rpcCalls: RpcCall[], lookup: "ok" | "error" | "reject" = "ok") {
  return {
    rpc: async (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      if (name === "claim_generation_type") return { data: true, error: null };
      if (name === "record_generation_result") return { data: "needs_attention", error: null };
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            if (lookup === "reject") throw new Error("socket hang up");
            if (lookup === "error") return { data: null, error: { message: "connection reset" } };
            return {
            data: {
              photography_session_id: SESSION, model_name: "claude-sonnet-4-6",
              session_facts_snapshot: { service_type: "grads", school_slug: null, primary_location: null },
              generation_settings: {},
            },
            error: null,
          };
          },
        }),
      }),
    }),
  } as unknown as Parameters<typeof generateContentType>[0]["client"];
}

const timeoutError = () => new Anthropic.APIConnectionTimeoutError({ message: "Request timed out." });

let rpcCalls: RpcCall[];
let modelCalls: ModelCallRequest[];
beforeEach(() => {
  rpcCalls = [];
  modelCalls = [];
});

describe("generateContentType under a deadline", () => {
  it("claims with the lease that covers the whole invocation and bounds the model call inside the deadline", async () => {
    const start = 1_000_000;
    let now = start;
    const callModel: ModelCaller = async (req) => {
      modelCalls.push(req);
      now += 5_000;
      return { text: "{}", usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
    };
    const result = await generateContentType({
      client: fakeClient(rpcCalls), callModel, packageId: PACKAGE, contentType: "internal_link_suggestion",
      deadlineAt: start + GENERATION_DEADLINE_MS, now: () => now,
    });
    expect(result.outcome).toBe("completed");
    expect(rpcCalls[0]).toMatchObject({ name: "claim_generation_type", params: { p_lease_seconds: GENERATION_LEASE_SECONDS } });
    expect(modelCalls).toHaveLength(1);
    expect(modelCalls[0].maxRetries).toBe(0);
    expect(modelCalls[0].timeoutMs).toBeGreaterThan(0);
    expect(modelCalls[0].timeoutMs).toBeLessThanOrEqual(GENERATION_DEADLINE_MS);
  });

  it("a provider timeout is caught, recorded failed (lease cleared by the RPC), and reported retryable", async () => {
    const start = 5_000_000;
    let now = start;
    const callModel: ModelCaller = async (req) => {
      modelCalls.push(req);
      now += req.timeoutMs ?? 0; // the SDK gives up exactly at the timeout
      throw timeoutError();
    };
    const result = await generateContentType({
      client: fakeClient(rpcCalls), callModel, packageId: PACKAGE, contentType: "internal_link_suggestion",
      deadlineAt: start + 120_000, now: () => now, sleep: async () => {},
    });
    expect(result.outcome).toBe("failed");
    expect(result.failure).toEqual({ kind: "timeout", retryable: true });
    expect(result.error).toMatch(/timed out/i);
    expect(now - start).toBeLessThanOrEqual(120_000); // the call ended by the deadline
    const recorded = rpcCalls.find((c) => c.name === "record_generation_result")!;
    expect(recorded.params).toMatchObject({ p_outcome: "failed", p_content_type: "internal_link_suggestion" });
    expect(String(recorded.params.p_error)).not.toMatch(/\bu\b|\bs\b/); // never the prompt
    expect(modelCalls).toHaveLength(1); // a timeout is not retried — there is no time left
  });

  it("a transient provider error is retried inside the same deadline, with one terminal record", async () => {
    const start = 9_000_000;
    let now = start;
    const sleeps: number[] = [];
    const callModel: ModelCaller = async (req) => {
      modelCalls.push(req);
      now += 2_000;
      if (modelCalls.length === 1) {
        throw new Anthropic.APIError(529, { type: "overloaded_error" }, "Overloaded", new Headers());
      }
      return { text: "{}", usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
    };
    const result = await generateContentType({
      client: fakeClient(rpcCalls), callModel, packageId: PACKAGE, contentType: "internal_link_suggestion",
      deadlineAt: start + 120_000, now: () => now, sleep: async (ms) => { sleeps.push(ms); now += ms; },
    });
    expect(result.outcome).toBe("completed");
    expect(modelCalls).toHaveLength(2);
    expect(sleeps).toHaveLength(1);
    expect(modelCalls[1].timeoutMs!).toBeLessThan(modelCalls[0].timeoutMs!); // the retry gets what is left
    expect(rpcCalls.filter((c) => c.name === "record_generation_result")).toHaveLength(1);
  });

  it("refuses to start a model call when less than the minimum window is left, failing fast and retryable", async () => {
    const start = 100_000;
    const callModel: ModelCaller = async (req) => {
      modelCalls.push(req);
      return { text: "{}", usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
    };
    const result = await generateContentType({
      client: fakeClient(rpcCalls), callModel, packageId: PACKAGE, contentType: "internal_link_suggestion",
      deadlineAt: start + MIN_MODEL_CALL_MS - 1, now: () => start,
    });
    expect(result.outcome).toBe("failed");
    expect(result.failure).toEqual({ kind: "timeout", retryable: true });
    expect(modelCalls).toHaveLength(0);
  });

  it.each(["error", "reject"] as const)("a package lookup %s after the claim records the type failed instead of leaving it processing", async (lookup) => {
    const callModel: ModelCaller = async (req) => {
      modelCalls.push(req);
      return { text: "{}", usage: { input_tokens: 1, output_tokens: 1 }, model: req.model };
    };
    const result = await generateContentType({
      client: fakeClient(rpcCalls, lookup), callModel, packageId: PACKAGE, contentType: "internal_link_suggestion",
      deadlineAt: 1_000_000 + GENERATION_DEADLINE_MS, now: () => 1_000_000,
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/package lookup failed|socket hang up/);
    expect(modelCalls).toHaveLength(0);
    expect(rpcCalls.map((c) => c.name)).toEqual(["claim_generation_type", "record_generation_result"]);
    expect(rpcCalls[1].params).toMatchObject({ p_outcome: "failed" });
  });

  it("says so when the failure itself could not be recorded, rather than calling the type terminal", async () => {
    const client = {
      ...fakeClient(rpcCalls, "reject"),
      rpc: async (name: string, params: Record<string, unknown>) => {
        rpcCalls.push({ name, params });
        if (name === "claim_generation_type") return { data: true, error: null };
        return { data: null, error: { message: "db down" } };
      },
    } as unknown as Parameters<typeof generateContentType>[0]["client"];
    const result = await generateContentType({
      client, callModel: async () => { throw new Error("never"); }, packageId: PACKAGE, contentType: "internal_link_suggestion",
      deadlineAt: 1_000_000 + GENERATION_DEADLINE_MS, now: () => 1_000_000,
    });
    expect(result.outcome).toBe("failed");
    expect(result.unrecorded).toBe(true);
  });
});
