// /api/admin/session-content/generate: the deployed duration budget and the
// error contract for a recorded timeout (structured + retryable, not a 504).
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GENERATE_ROUTE_MAX_DURATION_SECONDS, GENERATION_DEADLINE_MS } from "@/lib/contentEngine/generationBudget";

const generateContentType = vi.fn();

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/contentEngine/aiClient", () => ({ createAnthropicCaller: () => async () => ({}) }));
vi.mock("@/lib/contentEngine/generateContent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contentEngine/generateContent")>(
    "@/lib/contentEngine/generateContent",
  );
  return { ...actual, generateContentType: (...a: unknown[]) => generateContentType(...a) };
});

process.env.ANTHROPIC_API_KEY = "test";
const route = await import("@/app/api/admin/session-content/generate/route");

const post = (body: unknown) => route.POST(new NextRequest("http://localhost/api/admin/session-content/generate", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));

describe("generate route", () => {
  it("exports the long-AI-work duration, not the 60s that killed the guide step", () => {
    expect(route.maxDuration).toBe(GENERATE_ROUTE_MAX_DURATION_SECONDS);
    expect(route.runtime).toBe("nodejs");
  });

  it("hands the service a deadline inside its own duration", async () => {
    generateContentType.mockResolvedValueOnce({ outcome: "completed", itemIds: [], packageStatus: "ready" });
    const before = Date.now();
    const res = await post({ packageId: "22222222-2222-4222-8222-222222222222", contentType: "guide_photo" });
    expect(res.status).toBe(200);
    const args = generateContentType.mock.calls[0][0] as { deadlineAt: number };
    expect(args.deadlineAt).toBeGreaterThanOrEqual(before + GENERATION_DEADLINE_MS);
    expect(args.deadlineAt).toBeLessThan(before + GENERATE_ROUTE_MAX_DURATION_SECONDS * 1000);
  });

  it("a recorded timeout answers with a structured, retryable generation error", async () => {
    generateContentType.mockResolvedValueOnce({
      outcome: "failed", itemIds: [], packageStatus: "needs_attention",
      error: "model call timed out after 240s", failure: { kind: "timeout", retryable: true },
    });
    const res = await post({ packageId: "22222222-2222-4222-8222-222222222222", contentType: "guide_photo" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ outcome: "failed", error: "model call timed out after 240s", failure: { kind: "timeout", retryable: true } });
  });
});
