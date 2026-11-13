// One synthetic booking, read for both Pixieset documents: senior portraits
// for a sports team, eight players, a photographer-confirmed $1,200 hour, and
// a session date the client has asked for but nobody has accepted yet.
//
// The routes run end to end with Gmail, Claude and Supabase mocked, so what
// is proven here is everything AFTER the model's answer: the transcript, the
// normalizer, the shared resolver and the two responses. Whether the real
// model reads this thread this way is measured separately
// (tests/live/evalSeniorPortraitThread.ts). Every name, address, id and
// venue is invented.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SECRET = "test-extension-secret";
const STUDIO_ADDRESS = "studio@example.test";

const mocks = vi.hoisted(() => {
  process.env.CRON_SECRET = "test-extension-secret";
  return {
    claudeText: "{}",
    claudeCalls: [] as { temperature?: number; user: string }[],
    inquiry: null as Record<string, unknown> | null,
    laterInquiries: [] as { created_at: string }[],
    gmail: [] as { id: string; from: string; date: string; body: string }[],
    failIds: [] as string[],
    queries: [] as string[],
  };
});

vi.mock("@/lib/gmailTokens", () => ({ getValidTokens: async () => ({ access_token: "tok", refresh_token: null, expiry_date: 0, email: "studio@example.test" }) }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.inquiry, error: null }),
          gt: () => ({ order: () => ({ limit: async () => ({ data: mocks.laterInquiries, error: null }) }) }),
        }),
      }),
    }),
  }),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: async (args: { temperature?: number; messages: { content: string }[] }) => {
        mocks.claudeCalls.push({ temperature: args.temperature, user: args.messages[0]?.content ?? "" });
        return { content: [{ type: "text", text: mocks.claudeText }] };
      },
    };
  },
}));

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64url");
const gmailMessage = (m: { id: string; from: string; date: string; body: string }) => ({
  id: m.id, threadId: "thread-senior", internalDate: String(Date.parse(m.date)), labelIds: ["INBOX"],
  payload: { mimeType: "text/plain", body: { data: b64(m.body) }, headers: [{ name: "From", value: m.from }] },
});

vi.stubGlobal("fetch", async (url: string | URL) => {
  const u = String(url);
  if (u.endsWith("/profile")) return Response.json({ emailAddress: STUDIO_ADDRESS });
  if (u.endsWith("/settings/sendAs")) return Response.json({ sendAs: [] });
  if (u.includes("/messages?q=")) {
    mocks.queries.push(decodeURIComponent(u.split("q=")[1].split("&")[0]));
    return Response.json({ messages: mocks.gmail.map((m) => ({ id: m.id })) });
  }
  if (u.includes("/threads/")) return Response.json({ messages: mocks.gmail.filter((m) => !mocks.failIds.includes(m.id)).map(gmailMessage) });
  const one = mocks.gmail.find((m) => u.includes(`/messages/${m.id}?`));
  if (one && !mocks.failIds.includes(one.id)) return Response.json(gmailMessage(one));
  return new Response("not found", { status: 404 });
});

const detectDate = await import("@/app/api/extension/detect-date/route");
const invoiceDraft = await import("@/app/api/extension/invoice-draft/route");

const request = (path: string) => new NextRequest(`http://localhost/api/extension/${path}`, {
  method: "POST", body: JSON.stringify({ inquiry_id: 9101 }), headers: { "content-type": "application/json", "x-extension-secret": SECRET },
});
const contract = async () => (await detectDate.POST(request("detect-date"))).json();
const invoice = async () => (await invoiceDraft.POST(request("invoice-draft"))).json();

const CLIENT = "Jordan Example <jordan@example.test>";
const STUDIO = `Studio <${STUDIO_ADDRESS}>`;
const VENUE = "Harbor Practice Field";
const DELIVERABLES = "5 edited portraits per player (2 headshots, 3 full-body) plus 2 group photos";

const THREAD = [
  { id: "syn-01", from: CLIENT, date: "2026-11-02T17:00:00Z", body: "Hi! Do you take senior portraits for sports teams?" },
  { id: "syn-02", from: CLIENT, date: "2026-11-02T17:20:00Z", body: "We are eight soccer players who want senior portraits out on a field." },
  { id: "syn-03", from: STUDIO, date: "2026-11-03T18:00:00Z", body: "Happy to! I have Nov 21, Nov 22, Nov 29 and Dec 5 open, and around 4 PM usually works well.\n\nStudio Example\nPortrait | Graduation\nSan Francisco, CA" },
  { id: "syn-04", from: CLIENT, date: "2026-11-04T17:00:00Z", body: `Could we shoot at ${VENUE}?` },
  { id: "syn-05", from: STUDIO, date: "2026-11-04T19:00:00Z", body: `${VENUE} works. Two options: 30 minutes is $800 total ($100 per player), or 60 minutes is $1,200 total ($150 per player).` },
  { id: "syn-06", from: CLIENT, date: "2026-11-05T17:00:00Z", body: "Can you confirm the one-hour total is $1,200?" },
  { id: "syn-07", from: STUDIO, date: "2026-11-05T18:00:00Z", body: `Confirmed: $1,200 total for the one-hour session for all eight players. Each player gets five edited portraits (two headshots and three full-body), plus two group photos at ${VENUE}.` },
  { id: "syn-08", from: CLIENT, date: "2026-11-12T17:00:00Z", body: "Great, that pricing and package work for us. Could we do 29th Nov around 3pm?" },
];
const ACCEPTANCE = { id: "syn-09", from: STUDIO, date: "2026-11-12T19:00:00Z", body: "Yes, November 29 at 3 PM is confirmed. See you then!" };

// What a careful reading of the thread returns. The year is deliberately the
// wrong one: the date must come from the client's own words, not from here.
const answer = (over: Record<string, unknown> = {}) => JSON.stringify({
  date: "2027-11-29", date_text: "29th Nov", date_message: 8, date_status: "proposed",
  time: "3:00 PM", time_status: "proposed", location: VENUE, session_type: "senior-portraits",
  total_fee: 1200, total_kind: "agreed_total", total_status: "confirmed", includes_travel: null, total_fee_message: 7,
  package: { status: "selected", minutes: 60, source_message: 6 }, people: 8, deliverables: DELIVERABLES, confidence: "medium",
  ...over,
});

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-13T20:00:00Z")); });
afterAll(() => { vi.useRealTimers(); });

beforeEach(() => {
  mocks.claudeCalls = [];
  mocks.queries = [];
  mocks.failIds = [];
  mocks.laterInquiries = [];
  mocks.gmail = [...THREAD];
  mocks.claudeText = answer();
  // The form is stale on purpose: one person, the "Graduation Portrait" dropdown and a school.
  mocks.inquiry = {
    id: 9101, name: "Jordan Example", email: "jordan@example.test", school: "SF State", location: null, people: "1",
    session_type: "Graduation Portrait", message: "Hi, looking to book portraits.", date_in_mind: null, created_at: "2026-11-02T16:55:00Z",
  };
});

describe("the requested date (not yet accepted)", () => {
  it("resolves the same booking for the contract and the invoice", async () => {
    const [c, i] = [await contract(), await invoice()];
    expect(c.resolved).toEqual(i.draft);
    expect(c.revision).toBe(i.facts.revision);
    expect(c.revision).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is senior portraits for eight, not a graduation for one", async () => {
    const { draft } = await invoice();
    expect(draft.session).toMatchObject({ serviceKey: "senior-portraits", itemName: "Senior Portraits", people: 8, durationMinutes: 60 });
    expect(JSON.stringify(draft)).not.toMatch(/graduat/i);
  });

  it("keeps the agreed $1,200 although the date is only a request", async () => {
    const { draft } = await invoice();
    expect(draft.pricing).toMatchObject({ baseCents: 120000, agreedTotalCents: 120000, totalCents: 120000, baseConfirmed: true });
    // Never eight times the total, the per-player rate, the other option, or eight graduates.
    for (const wrong of [960000, 15000, 80000, 200000]) expect(draft.pricing.totalCents).not.toBe(wrong);
  });

  it("keeps November 29, 2026 at 3 PM as proposed, and does not set a due date from it", async () => {
    const { draft } = await invoice();
    expect(draft.session).toMatchObject({ date: "2026-11-29", dateStatus: "proposed", dateConfidence: "tentative" });
    expect(draft.session.timeDetail).toMatchObject({ status: "proposed", start: "15:00", end: "16:00" });
    expect(draft.dueDate).toBeNull();
    expect(draft.warnings.join(" ")).toMatch(/November 29th, 2026 was requested and has not been accepted/);
  });

  it("takes the year from the day the client wrote the date, not from the model", async () => {
    const c = await contract();
    expect(c.date).toBe("2026-11-29");
    expect(c.readable).toBe("November 29th, 2026");
    expect(c.date_status).toBe("proposed");
  });

  it("uses the named field, never the school or the signature's city, and asks about travel instead of inventing it", async () => {
    const { draft } = await invoice();
    expect(draft.session).toMatchObject({ location: VENUE, locationSource: "email" });
    expect(draft.pricing.travel).toEqual({ kind: "unknown", amountCents: null, place: VENUE });
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/Harbor Practice Field .*no approved travel fee/);
  });

  it("describes what was promised: forty portraits and two group photos, not a graduation gallery", async () => {
    const { draft } = await invoice();
    expect(draft.session.description).toBe(`Eight people, 60-minute session, ${DELIVERABLES}`);
  });

  it("reads the transcript deterministically and tells the model when the form was sent", async () => {
    await invoice();
    expect(mocks.claudeCalls).toHaveLength(1);
    expect(mocks.claudeCalls[0].temperature).toBe(0);
    expect(mocks.claudeCalls[0].user).toContain("Inquiry submitted: 2026-11-02");
    expect(mocks.claudeCalls[0].user).toContain("--- Message 8 of 8 | CLIENT → PHOTOGRAPHER | Nov 12, 2026 | thread 1 ---");
  });
});

describe("the accepted date", () => {
  beforeEach(() => {
    mocks.gmail = [...THREAD, ACCEPTANCE];
    mocks.claudeText = answer({ date: "2026-11-29", date_status: "confirmed", time_status: "confirmed" });
  });

  it("is confirmed in both documents and becomes the invoice's due date", async () => {
    const [c, i] = [await contract(), await invoice()];
    expect(c.resolved).toEqual(i.draft);
    expect(i.draft.session).toMatchObject({ date: "2026-11-29", dateStatus: "confirmed", dateConfidence: "confirmed" });
    expect(i.draft.session.timeDetail.status).toBe("confirmed");
    expect(i.draft.dueDate).toBe("2026-11-29");
    expect(i.draft.pricing.totalCents).toBe(120000);
  });

  it("has a different revision from the thread without the acceptance", async () => {
    const withAcceptance = (await contract()).revision;
    mocks.gmail = [...THREAD];
    expect((await contract()).revision).not.toBe(withAcceptance);
  });
});

describe("evidence that does not hold up", () => {
  it("does not take a confirmed total the photographer never wrote or answered", async () => {
    mocks.claudeText = answer({ total_fee: 1150 });
    const { draft, facts } = await invoice();
    expect(facts.total_status).toBe("proposed");
    expect(draft.pricing).toMatchObject({ totalCents: null, baseConfirmed: false, agreedTotalCents: 115000 });
    expect(draft.reviewReasons.join(" ")).toMatch(/\$1,150 .*not a settled total/);
  });

  it("does not take a per-player rate, a quote or an unaccepted figure as the total", async () => {
    for (const over of [{ total_fee: 150, total_kind: "unclear" }, { total_kind: "quote" }, { total_status: "proposed" }, { total_status: "conflicting" }]) {
      mocks.claudeText = answer(over);
      const { draft } = await invoice();
      expect(draft.pricing.totalCents, JSON.stringify(over)).toBeNull();
      expect(draft.pricing.baseConfirmed, JSON.stringify(over)).toBe(false);
    }
  });

  it("leaves the price to a person when the thread only shows a menu", async () => {
    mocks.claudeText = answer({ total_fee: null, total_kind: null, total_status: null, package: { status: "none" } });
    const { draft } = await invoice();
    expect(draft.pricing).toMatchObject({ totalCents: null, baseConfirmed: false, baseCents: 0 });
    expect(draft.reviewReasons.join(" ")).toMatch(/Senior portraits are quoted per booking/);
  });

  it("says so when a message could not be loaded, instead of reading the rest as the whole thread", async () => {
    mocks.failIds = ["syn-08"];
    const { draft, facts } = await invoice();
    expect(facts.email_status).toBe("partial");
    expect(facts.email_coverage.failed).toBeGreaterThan(0);
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/could not be loaded/);
  });

  it("says so when the model's answer is unusable, and never prices the stale form as a graduation silently", async () => {
    mocks.claudeText = "I could not find a JSON answer";
    const { draft, facts } = await invoice();
    expect(facts.email_status).toBe("unparsed");
    expect(draft.status).toBe("review");
    expect(draft.reviewReasons.join(" ")).toMatch(/could not be interpreted/);
  });

  it("returns 502 rather than a default when the thread cannot be read at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.claudeText = "{}";
    const failing = vi.fn(async () => { throw new Error("model unavailable"); });
    const sdk = await import("@anthropic-ai/sdk");
    const original = sdk.default.prototype;
    const spy = vi.spyOn(sdk, "default").mockImplementation(function Failing() { return { messages: { create: failing } }; } as never);
    expect((await invoiceDraft.POST(request("invoice-draft"))).status).toBe(502);
    expect((await detectDate.POST(request("detect-date"))).status).toBe(502);
    spy.mockRestore();
    expect(sdk.default.prototype).toBe(original);
  });
});

describe("the booking's own mail", () => {
  it("searches from two weeks before the form and never an earlier booking's mail", async () => {
    await invoice();
    const after = Math.floor(Date.parse("2026-10-19T16:55:00Z") / 1000);
    expect(mocks.queries[0]).toBe(`{from:jordan@example.test to:jordan@example.test} after:${after}`);
  });

  it("stops at the same client's next booking, but not at a quick resubmission of the form", async () => {
    mocks.laterInquiries = [{ created_at: "2027-03-01T17:00:00Z" }];
    await invoice();
    expect(mocks.queries[0]).toMatch(/ before:\d+$/);
    mocks.queries = [];
    mocks.laterInquiries = [{ created_at: "2026-11-06T17:00:00Z" }];
    await invoice();
    expect(mocks.queries[0]).not.toMatch(/before:/);
  });
});
