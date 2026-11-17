// /api/extension/detect-date end to end with Gmail, Claude and Supabase
// mocked: the model sees a sender-labelled, quote-stripped transcript, and
// the response carries the catalog-priced Rush preview charge next to the
// facts the extension already reads. Everything here is synthetic.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SECRET = "test-extension-secret";

const mocks = vi.hoisted(() => {
  process.env.CRON_SECRET = "test-extension-secret";
  return {
    claudeText: "{}",
    claudeUserContent: "",
    tokens: { access_token: "tok", refresh_token: null, expiry_date: 0, email: "studio@example.test" } as object | null,
    inquiry: null as Record<string, unknown> | null,
    gmailMessages: [] as { id: string; from: string; date: string; body: string }[],
  };
});

vi.mock("@/lib/gmailTokens", () => ({ getValidTokens: async () => mocks.tokens }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.inquiry, error: null }) }) }) }),
  }),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: async (args: { messages: { content: string }[] }) => {
        mocks.claudeUserContent = args.messages[0]?.content ?? "";
        return { content: [{ type: "text", text: mocks.claudeText }] };
      },
    };
  },
}));

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64url");

vi.stubGlobal("fetch", async (url: string | URL) => {
  const u = String(url);
  if (u.endsWith("/profile")) return Response.json({ emailAddress: "studio@example.test" });
  if (u.endsWith("/settings/sendAs")) return Response.json({ sendAs: [] });
  if (u.includes("/messages?q=")) return Response.json({ messages: mocks.gmailMessages.map(m => ({ id: m.id })) });
  const one = mocks.gmailMessages.find(m => u.includes(`/messages/${m.id}?`));
  if (one) {
    return Response.json({
      id: one.id, threadId: "thread-1", internalDate: String(Date.parse(one.date)), labelIds: ["INBOX"],
      payload: { mimeType: "text/plain", body: { data: b64(one.body) }, headers: [{ name: "From", value: one.from }, { name: "Subject", value: "Proposal photos" }] },
    });
  }
  return new Response("not found", { status: 404 });
});

const route = await import("@/app/api/extension/detect-date/route");

const post = (body: unknown, secret: string | null = SECRET) => route.POST(new NextRequest("http://localhost/api/extension/detect-date", {
  method: "POST", body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...(secret ? { "x-extension-secret": secret } : {}) },
}));

const CLIENT = "Example Client <client@example.test>";
const STUDIO = "Studio <studio@example.test>";

beforeEach(() => {
  mocks.claudeUserContent = "";
  mocks.tokens = { access_token: "tok", refresh_token: null, expiry_date: 0, email: "studio@example.test" };
  mocks.inquiry = {
    id: 7001, name: "Example Client", email: "client@example.test", date_in_mind: "November 20",
    message: "— Session request —\nPackage: Proposal Session\nLocation: San Francisco", session_type: "Couples Session", school: null, people: "2",
  };
  mocks.gmailMessages = [
    { id: "m1", from: CLIENT, date: "2026-11-02T17:00:00Z", body: "Hi! I'd like to book a proposal session in San Francisco on November 20." },
    { id: "m2", from: STUDIO, date: "2026-11-02T18:00:00Z", body: "The proposal session is $750. A Rush preview is available if you want it." },
    { id: "m3", from: CLIENT, date: "2026-11-05T17:00:00Z", body: "Please add the Rush Preview to my booking.\n\nOn Nov 2, 2026 Studio wrote:\n> The proposal session is $750 QUOTED_OLD_LINE" },
  ];
  mocks.claudeText = JSON.stringify({
    date: "2026-11-20", date_status: "confirmed", readable: "November 20th, 2026", time: null, location: "San Francisco", session_type: "proposal",
    total_fee: 750, total_kind: "quote", includes_travel: null, total_fee_message: 2,
    rush_preview: { status: "selected", source_message: 3, evidence: "Please add the Rush Preview", in_total: false },
    confidence: "high",
  });
});

describe("detect-date", () => {
  it("rejects a missing or wrong extension secret", async () => {
    expect((await post({ inquiry_id: 913 }, null)).status).toBe(401);
    expect((await post({ inquiry_id: 913 }, "nope")).status).toBe(401);
  });

  it("shows the model who wrote each message, in order, without quoted history", async () => {
    await post({ inquiry_id: 913 });
    const sent = mocks.claudeUserContent;
    expect(sent).toContain("--- Message 1 of 3 | CLIENT → PHOTOGRAPHER | Nov 2, 2026 | thread 1 ---");
    expect(sent).toContain("--- Message 2 of 3 | PHOTOGRAPHER → CLIENT | Nov 2, 2026 | thread 1 ---");
    expect(sent).toContain("--- Message 3 of 3 | CLIENT → PHOTOGRAPHER | Nov 5, 2026 | thread 1 ---");
    expect(sent.indexOf("I'd like to book")).toBeLessThan(sent.indexOf("Rush preview is available"));
    expect(sent).not.toContain("QUOTED_OLD_LINE");
    expect(sent).toContain("Please add the Rush Preview to my booking.");
  });

  it("returns the facts the extension already reads plus the catalog-priced Rush preview charge", async () => {
    const res = await post({ inquiry_id: 913 });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.json();
    expect(body).toMatchObject({
      readable: "November 20th, 2026", location: "San Francisco", session_type: "proposal", total_fee: 750, total_kind: "quote", confidence: "high",
      rush_preview: { selection: "selected", source: "email", source_message: 3, included_in_total: false, total_fee_message: 2 },
      rush_preview_charge: { kind: "add", amountCents: 7500, label: "Rush preview" },
    });
  });

  it("charges nothing when neither the thread nor the form selected Rush preview", async () => {
    mocks.claudeText = JSON.stringify({ location: "San Francisco", session_type: "proposal", total_fee: 750, total_kind: "quote", confidence: "high" });
    const body = await (await post({ inquiry_id: 913 })).json();
    expect(body.rush_preview.selection).toBe("none");
    expect(body.rush_preview_charge).toMatchObject({ kind: "none", amountCents: 0 });
  });

  it("falls back to the inquiry form when Gmail is not connected, keeping the form's Rush preview", async () => {
    mocks.tokens = null;
    mocks.inquiry = { ...mocks.inquiry!, message: "— Session request —\nPackage: Proposal Session\nAdd-ons: Rush preview\nEstimated total: $825" };
    const body = await (await post({ inquiry_id: 913 })).json();
    expect(body.email_status).toBe("unavailable");
    expect(body.rush_preview).toMatchObject({ selection: "selected", source: "inquiry" });
    expect(body.rush_preview_charge).toMatchObject({ kind: "add", amountCents: 7500 });
  });

  it("sends unresolved Rush preview wording to review instead of inventing a total", async () => {
    mocks.claudeText = JSON.stringify({ session_type: "proposal", total_fee: 800, total_kind: "agreed_total", total_fee_message: 2, rush_preview: { status: "unclear", source_message: 3 }, confidence: "medium" });
    const body = await (await post({ inquiry_id: 913 })).json();
    expect(body.rush_preview_charge.kind).toBe("review");
    expect(body.rush_preview_charge.amountCents).toBeNull();
    expect(body.rush_preview_charge.note).toMatch(/Rush preview/);
  });

  it("returns the description of services written from the same facts, with the Rush Preview the client added", async () => {
    const body = await (await post({ inquiry_id: 913 })).json();
    expect(body.services).toMatchObject({ serviceKey: "proposal", packageKey: "proposal", status: "ready", reviewReasons: [] });
    expect(body.services.text).toBe("Proposal photography session. Minimum of 50 edited images delivered within two weeks through an online gallery.\nRush Preview: 5 edited images delivered within 48 hours.");
    expect(JSON.stringify(body.services)).not.toMatch(/Please add|QUOTED_OLD_LINE|source_message/);
  });

  it("writes an image count only when the photographer's own message carries it", async () => {
    const answer = { session_type: "proposal", confidence: "high", image_commitment: { count: 80, per_person: false } };
    mocks.claudeText = JSON.stringify(answer);
    const unbacked = await (await post({ inquiry_id: 913 })).json();
    expect(unbacked.services.text).toContain("Minimum of 50 edited images");
    expect(unbacked.services.status).toBe("review");
    mocks.gmailMessages = [...mocks.gmailMessages, { id: "m4", from: STUDIO, date: "2026-11-06T17:00:00Z", body: "You'll receive a minimum of 80 edited images." }];
    const backed = await (await post({ inquiry_id: 913 })).json();
    expect(backed.services.text).toContain("Minimum of 80 edited images");
  });

  it("sends the description to review when Gmail could not be read", async () => {
    mocks.tokens = null;
    const body = await (await post({ inquiry_id: 913 })).json();
    expect(body.services.status).toBe("review");
    expect(body.services.reviewReasons.join(" ")).toMatch(/email thread was not read/);
  });
});
