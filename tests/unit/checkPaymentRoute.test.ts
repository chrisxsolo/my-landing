// Route-level tests for /api/check-payment with Gmail, Claude, and Supabase
// mocked. The key invariant: an unparseable model response is a 502
// application error and writes NOTHING — it must never become "unpaid".
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  claudeText: "",
  claudeError: null as Error | null,
  updates: [] as { table: string; values: Record<string, unknown> }[],
  upserts: [] as { table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/gmailTokens", () => ({ getValidTokens: async () => ({ access_token: "test-token" }) }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          mocks.updates.push({ table, values });
          return { error: null };
        },
      }),
      upsert: async (values: Record<string, unknown>) => {
        mocks.upserts.push({ table, values });
        return { error: null };
      },
    }),
  }),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: async () => {
        if (mocks.claudeError) throw mocks.claudeError;
        return { content: [{ type: "text", text: mocks.claudeText }] };
      },
    };
  },
}));

const PLAIN_BODY = Buffer.from("Hi Chris! I just sent the deposit via Venmo — $200.", "utf-8")
  .toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

vi.stubGlobal("fetch", async (url: string | URL) => {
  const u = String(url);
  if (u.includes("/messages/msg1")) {
    return Response.json({ payload: { mimeType: "text/plain", body: { data: PLAIN_BODY } } });
  }
  if (u.includes("/messages?q=")) {
    return Response.json({ messages: [{ id: "msg1" }] });
  }
  return new Response("not found", { status: 404 });
});

async function callRoute() {
  const { POST } = await import("@/app/api/check-payment/route");
  const req = new NextRequest("http://localhost/api/check-payment", {
    method: "POST",
    body: JSON.stringify({ inquiry_id: "42", email: "jane@example.com", name: "Jane Doe" }),
  });
  return POST(req);
}

beforeEach(() => {
  mocks.claudeText = "";
  mocks.claudeError = null;
  mocks.updates.length = 0;
  mocks.upserts.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/check-payment", () => {
  it("returns 502 and writes nothing when the model output is unparseable", async () => {
    mocks.claudeText = "I'm sorry, I couldn't determine the payment status from these emails.";
    const res = await callRoute();
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.code).toBe("PAYMENT_RESPONSE_PARSE_FAILED");
    expect(json.error).toBe("Payment analysis returned an invalid response.");
    expect(json.raw_preview.length).toBeLessThanOrEqual(200);
    // The failure must not be recorded as "unpaid" — no DB writes at all.
    expect(mocks.updates).toHaveLength(0);
    expect(mocks.upserts).toHaveLength(0);
  });

  it("returns 502 and writes nothing when the Claude request fails", async () => {
    mocks.claudeError = new Error("api down");
    const res = await callRoute();
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.code).toBe("PAYMENT_ANALYSIS_FAILED");
    expect(mocks.updates).toHaveLength(0);
  });

  it("marks the inquiry paid when Claude returns fenced JSON", async () => {
    mocks.claudeText =
      '```json\n{"paid": true, "amount": "$200", "method": "Venmo", "note": "Client confirmed the deposit"}\n```';
    const res = await callRoute();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.paid).toBe(true);
    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].table).toBe("inquiries");
    expect(mocks.updates[0].values.payment_status).toBe("paid");
    expect(mocks.updates[0].values.booking_confirmed).toBe(true);
    expect(String(mocks.updates[0].values.payment_note)).toContain("$200");
  });

  it("records an unpaid check as a note only, never as a payment", async () => {
    mocks.claudeText = '{"paid": false, "amount": null, "method": null, "note": "No payment evidence found"}';
    const res = await callRoute();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.paid).toBe(false);
    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].values.payment_status).toBeUndefined();
    expect(mocks.updates[0].values.payment_note).toBe("No payment evidence found");
  });
});
