// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/learn — the JSON contract the Learn panel depends on.
//
// Auth, the rules store and the model are all mocked. The point is the shape:
// each stage of the flow has its own outcome code, a model failure never
// hides the deterministic result, and no response ever carries the drafting
// route's "draft request failed" message.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { WritingRule } from "@/lib/ai/writingRules";
import { fakeCaller } from "./fixtures";

const AI = `Hi Jordan,

Thank you so much for reaching out! I'd love to photograph your proposal at Baker Beach!

My proposal sessions are $450 for one hour and include around 40 edited photos.

Would sunset on November 15th work for you? Do you know roughly where you're planning to ask?

Once we settle on the details I'll send over the invoice and contract to lock it in!`;

const SENT = `Hi Jordan,

Thanks for reaching out! I'd love to photograph your proposal at Baker Beach.

Proposal sessions are $475 for an hour with around 40 edited photos.

Does sunset on November 15th work? Is there a spot you have in mind, and will anyone else be there?

Once the details are set I'll send the invoice and contract and we're locked in!`;

const mocks = vi.hoisted(() => ({
  rules: [] as WritingRule[],
  rulesError: null as Error | null,
  insertResult: "ok" as "ok" | "fail",
  inserted: [] as string[],
  usage: [] as Record<string, unknown>[],
  outcomes: [] as Record<string, unknown>[],
  caller: null as unknown,
}));

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/ai/aiEmailStore", () => ({
  fetchWritingRules: async () => { if (mocks.rulesError) throw mocks.rulesError; return mocks.rules; },
  insertWritingRule: async (input: { rule: string }) => {
    if (mocks.insertResult === "fail") return null;
    mocks.inserted.push(input.rule);
    return { id: `id-${mocks.inserted.length}`, rule: input.rule, category: "style", status: "pending", source: "learn-from-edit", createdAt: "2026-11-03T00:00:00Z" };
  },
  recordUsage: async (record: Record<string, unknown>) => { mocks.usage.push(record); },
  recordDraftOutcome: async (outcome: Record<string, unknown>) => { mocks.outcomes.push(outcome); },
}));
vi.mock("@/lib/ai/emailModel", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/emailModel")>();
  return { ...original, createEmailModelCaller: () => mocks.caller };
});

const { POST } = await import("@/app/api/ai/learn/route");

type LearnJson = {
  outcome?: string; edits?: { kind: string; category: string }[]; pending?: { rule: string }[];
  candidates?: unknown[]; message?: string; error?: string; error_code?: string; retryable?: boolean; api_calls?: number; code?: string;
};

async function post(body: unknown): Promise<{ status: number; json: LearnJson }> {
  const req = new NextRequest("https://soloxsnaps.com/api/ai/learn", {
    method: "POST", headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await POST(req);
  return { status: res.status, json: (await res.json()) as LearnJson };
}

beforeEach(() => {
  mocks.rules = []; mocks.rulesError = null; mocks.insertResult = "ok";
  mocks.inserted = []; mocks.usage = []; mocks.outcomes = [];
  mocks.caller = fakeCaller("- Keep the opening to a short thanks");
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("POST /api/ai/learn validation", () => {
  it("rejects malformed JSON with a code", async () => {
    const { status, json } = await post("{not json");
    expect(status).toBe(400);
    expect(json.code).toBe("invalid_request");
  });

  it("rejects a missing draft with a code", async () => {
    const { status, json } = await post({ ai_draft: AI, actual_sent: "", mode: "review" });
    expect(status).toBe(400);
    expect(json.code).toBe("invalid_request");
  });
});

describe("POST /api/ai/learn review mode", () => {
  it("returns unchanged for an identical send without calling the model", async () => {
    const call = fakeCaller("- never"); mocks.caller = call;
    const { status, json } = await post({ ai_draft: AI, actual_sent: AI.replace(/\n/g, "\r\n"), mode: "review" });
    expect(status).toBe(200);
    expect(json.outcome).toBe("unchanged");
    expect(json.api_calls).toBe(0);
    expect(call.calls).toHaveLength(0);
  });

  it("returns factual_only for a price fix without calling the model", async () => {
    const call = fakeCaller("- never"); mocks.caller = call;
    const { json } = await post({ ai_draft: "Hi Sam,\n\nThat's $350", actual_sent: "Hi Sam,\n\nThat's $375", mode: "review" });
    expect(json.outcome).toBe("factual_only");
    expect(json.edits?.map((e) => e.kind)).toEqual(["price_changed"]);
    expect(call.calls).toHaveLength(0);
    expect(mocks.inserted).toEqual([]);
  });

  it("stores pending rules exactly once on success", async () => {
    const { status, json } = await post({ ai_draft: AI, actual_sent: SENT, mode: "review" });
    expect(status).toBe(200);
    expect(json.outcome).toBe("rules_pending");
    expect(json.pending?.map((p) => p.rule)).toEqual(["Keep the opening to a short thanks"]);
    expect(mocks.inserted).toHaveLength(1);
    expect(json.api_calls).toBe(1);
    expect(mocks.usage).toHaveLength(1);
    expect(mocks.usage[0]).toMatchObject({ operation: "learn", success: true });
  });

  it("returns the detected edits when the model fails, with a learning-specific message", async () => {
    mocks.caller = async () => { throw new Error("Request timed out (ETIMEDOUT)"); };
    const { status, json } = await post({ ai_draft: AI, actual_sent: SENT, mode: "review" });
    expect(status).toBe(200);
    expect(json.outcome).toBe("phrasing_failed");
    expect(json.error_code).toBe("timeout");
    expect(json.retryable).toBe(true);
    expect((json.edits ?? []).length).toBeGreaterThan(0);
    expect(json.edits?.some((e) => e.kind === "price_changed")).toBe(true);
    expect(json.message).toMatch(/found \d+ changes/i);
    expect(json.message).not.toMatch(/draft request failed/i);
    expect(mocks.usage[0]).toMatchObject({ operation: "learn", success: false, error_kind: "timeout" });
    expect(mocks.inserted).toEqual([]);
  });

  it("returns persist_failed when phrased rules could not be stored", async () => {
    mocks.insertResult = "fail";
    const { json } = await post({ ai_draft: AI, actual_sent: SENT, mode: "review" });
    expect(json.outcome).toBe("persist_failed");
    expect(json.error_code).toBe("rules_write");
    expect(json.pending).toEqual([]);
    expect(json.message).not.toMatch(/waiting for/i);
  });

  it("returns a configuration failure code when no API key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { status, json } = await post({ ai_draft: AI, actual_sent: SENT, mode: "review" });
    expect(status).toBe(200);
    expect(json.outcome).toBe("phrasing_failed");
    expect(json.error_code).toBe("not_configured");
    expect((json.edits ?? []).length).toBeGreaterThan(0);
  });

  it("keeps the JSON contract when the rules store throws", async () => {
    mocks.rulesError = new Error("store down");
    const { status, json } = await post({ ai_draft: AI, actual_sent: SENT, mode: "review" });
    expect(status).toBe(200);
    expect(json.outcome).toBe("phrasing_failed");
    expect(json.error_code).toBe("rules_read");
    expect(mocks.inserted).toEqual([]);
  });
});

describe("POST /api/ai/learn auto mode", () => {
  it("records one measurement, writes no rule, and calls no model", async () => {
    const call = fakeCaller("- never"); mocks.caller = call;
    const { json } = await post({ ai_draft: AI, actual_sent: SENT, mode: "auto", inquiry_id: 42 });
    expect(json.outcome).toBe("style_candidates");
    expect(json.api_calls).toBe(0);
    expect(call.calls).toHaveLength(0);
    expect(mocks.inserted).toEqual([]);
    expect(mocks.outcomes).toHaveLength(1);
    expect(mocks.outcomes[0]).toMatchObject({ inquiryId: 42, sentUnchanged: false });
  });
});
