// A package chosen by email, in a different Gmail thread from the inquiry
// notification, through the real retrieval, attribution, normalisation and
// draft: Gmail, Claude and Supabase are mocked at the transport. Mocked model
// answers prove the plumbing, not the model's reading. All of it is synthetic.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SECRET = "test-extension-secret";

interface Mail { id: string; thread: string; from: string; date: string; body: string; html?: boolean }

const mocks = vi.hoisted(() => {
  process.env.CRON_SECRET = "test-extension-secret";
  return {
    claudeText: "{}", claudeUserContent: "", claudeCalls: 0,
    tokens: { access_token: "tok", refresh_token: null, expiry_date: 0, email: "studio@example.test" } as object | null,
    inquiry: null as Record<string, unknown> | null,
    mail: [] as Mail[],
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
        mocks.claudeCalls += 1;
        mocks.claudeUserContent = args.messages[0]?.content ?? "";
        return { content: [{ type: "text", text: mocks.claudeText }] };
      },
    };
  },
}));

const b64 = (text: string) => Buffer.from(text, "utf-8").toString("base64url");

function gmailMessage(m: Mail) {
  return {
    id: m.id, threadId: m.thread, internalDate: String(Date.parse(m.date)), labelIds: ["INBOX"],
    payload: { mimeType: m.html ? "text/html" : "text/plain", body: { data: b64(m.body) }, headers: [{ name: "From", value: m.from }, { name: "Subject", value: "Graduation photos" }] },
  };
}

vi.stubGlobal("fetch", async (url: string | URL) => {
  const u = String(url);
  if (u.endsWith("/profile")) return Response.json({ emailAddress: "studio@example.test" });
  if (u.endsWith("/settings/sendAs")) return Response.json({ sendAs: [] });
  if (u.includes("/messages?q=")) return Response.json({ messages: mocks.mail.map((m) => ({ id: m.id })) });
  const thread = /\/threads\/([^?]+)/.exec(u);
  if (thread) return Response.json({ id: thread[1], messages: mocks.mail.filter((m) => m.thread === thread[1]).map(gmailMessage) });
  const one = mocks.mail.find((m) => u.includes(`/messages/${m.id}?`));
  return one ? Response.json(gmailMessage(one)) : new Response("not found", { status: 404 });
});

const detect = await import("@/app/api/extension/detect-date/route");
const invoice = await import("@/app/api/extension/invoice-draft/route");

const request = (path: string) => new NextRequest(`http://localhost/api/extension/${path}`, {
  method: "POST", body: JSON.stringify({ inquiry_id: 4242 }), headers: { "content-type": "application/json", "x-extension-secret": SECRET },
});
const contract = async () => (await detect.POST(request("detect-date"))).json();

const CLIENT = "Alex Example <alex@example.test>";
const STUDIO = "Studio <studio@example.test>";
const QUOTE = "December 19 at 2:00 PM is available at the University of San Francisco. The 30-minute mini is $325; the 60-minute session is $425. Which would you like?";
const ACCEPT = "December 19 at 2:00 PM works perfectly. I would like to book the 60-minute session.";

const answer = (over: Record<string, unknown> = {}) => JSON.stringify({
  date: "2026-12-19", date_text: "December 19", date_message: 2, date_status: "confirmed", time: "2:00 PM", time_status: "confirmed",
  location: "University of San Francisco", session_type: "graduation", total_fee: 425, total_kind: "quote", total_status: "confirmed", total_fee_message: 2,
  package: { status: "selected", minutes: 60, source_message: 3, evidence: "I would like to book the 60-minute session" }, people: 1, confidence: "high", ...over,
});

beforeEach(() => {
  mocks.claudeCalls = 0;
  mocks.claudeUserContent = "";
  mocks.tokens = { access_token: "tok", refresh_token: null, expiry_date: 0, email: "studio@example.test" };
  mocks.inquiry = {
    id: 4242, name: "Alex Example", email: "alex@example.test", date_in_mind: "December 19", created_at: "2026-11-16T18:00:00Z",
    message: "Hi! I'm graduating and would love photos on campus. What packages do you offer?", session_type: "Graduation Portrait", school: "USF", people: "1", location: null,
  };
  mocks.mail = [
    { id: "n1", thread: "notification", from: CLIENT, date: "2026-11-16T18:00:05Z", body: "New inquiry from Alex Example: graduation photos, December 19." },
    { id: "q1", thread: "booking", from: STUDIO, date: "2026-11-16T20:00:00Z", body: QUOTE },
    { id: "q2", thread: "booking", from: CLIENT, date: "2026-11-17T02:00:00Z", body: ACCEPT },
  ];
  mocks.claudeText = answer();
});

describe("a package selected by email in its own thread", () => {
  it("keeps both decision messages, from both threads, with the right sender on each", async () => {
    await contract();
    const sent = mocks.claudeUserContent;
    expect(sent).toMatch(/Message 2 of 3 \| PHOTOGRAPHER → CLIENT \| Nov 16, 2026 \| thread 2 ---\n.*60-minute session is \$425/);
    expect(sent).toMatch(/Message 3 of 3 \| CLIENT → PHOTOGRAPHER \| Nov 16, 2026 \| thread 2 ---\n.*book the 60-minute session/);
    expect(sent).toContain("thread 1 ---");
  });

  it("survives HTML-only mail and a reply that quotes the whole quote back", async () => {
    mocks.mail[1] = { ...mocks.mail[1], html: true, body: `<div><p>${QUOTE.replace("; ", ";</p><p>")}</p></div>` };
    mocks.mail[2] = { ...mocks.mail[2], body: `${ACCEPT}\n\nOn Mon, Nov 16, 2026 at 12:00 PM Studio <studio@example.test> wrote:\n> ${QUOTE}\n> QUOTED_MARKER` };
    await contract();
    const sent = mocks.claudeUserContent;
    expect(sent).toContain("60-minute session is $425");
    expect(sent).toContain("I would like to book the 60-minute session.");
    expect(sent).not.toContain("QUOTED_MARKER");
    expect(sent).not.toContain("<p>");
  });

  it("resolves the hour from email with the confirmed date, the agreed start and the quoted $425", async () => {
    const body = await contract();
    expect(body).toMatchObject({ source: "email", email_status: "read", package: { status: "selected", minutes: 60 }, date_status: "confirmed", time_status: "confirmed" });
    expect(body.resolved).toMatchObject({
      status: "ready", reviewReasons: [],
      session: { serviceKey: "graduation", itemName: "Graduation Session", durationMinutes: 60, packageSource: "email", date: "2026-12-19", dateStatus: "confirmed", location: "University of San Francisco" },
      pricing: { baseCents: 42500, totalCents: 42500, baseConfirmed: true, travel: { kind: "included" } },
      dueDate: "2026-12-19",
    });
    const { time, timeDetail } = body.resolved.session;
    expect(timeDetail).toMatchObject({ status: "confirmed", start: "14:00", end: "15:00", endDerived: true, sunset: null });
    expect(time).toMatch(/^2:00/);
    expect(JSON.stringify(body.resolved)).not.toMatch(/No package chosen|Default:/);
  });

  it("lets a later mini replace the hour (the wording variants are read by tests/live/evalEmailPackageSelection.ts)", async () => {
    mocks.mail.push({ id: "q3", thread: "booking", from: CLIENT, date: "2026-11-17T05:00:00Z", body: "Actually, let's do the 30-minute mini instead." });
    mocks.claudeText = answer({ total_fee: 325, package: { status: "selected", minutes: 30, source_message: 4 } });
    const mini = (await contract()).resolved;
    expect(mini.session).toMatchObject({ itemName: "Graduation Mini", durationMinutes: 30, packageSource: "email" });
    expect(mini.pricing.totalCents).toBe(32500);
    expect(mini.session.timeDetail).toMatchObject({ start: "14:00", end: "14:30" });
  });

  it("uses a negotiated total the photographer is on record for, not the rate card", async () => {
    mocks.mail[1] = { ...mocks.mail[1], body: `${QUOTE} For you I can do the 60-minute session for $410 total.` };
    mocks.claudeText = answer({ total_fee: 410, total_kind: "agreed_total" });
    const { resolved } = await contract();
    expect(resolved.pricing).toMatchObject({ totalCents: 41000, baseConfirmed: true });
    expect(resolved.session).toMatchObject({ durationMinutes: 60, packageSource: "email" });
  });

  it("does not take a menu, a declined option or an unsettled choice for a selection", async () => {
    mocks.mail = mocks.mail.slice(0, 2);
    mocks.claudeText = answer({ total_fee: null, total_kind: null, total_status: null, package: { status: "none" }, time_status: "proposed", date_status: "proposed" });
    const menu = (await contract()).resolved;
    expect(menu.session.packageSource).toBe("default");
    expect(menu.dueDate).toBeNull();
    mocks.claudeText = answer({ total_fee: null, total_kind: null, total_status: null, package: { status: "conflicting" } });
    const open = (await contract()).resolved;
    expect(open).toMatchObject({ status: "review", pricing: { totalCents: null }, session: { durationMinutes: null, packageSource: "unresolved" } });
  });

  it("gives the invoice the same session, time and total, with one model call each", async () => {
    const fromContract = (await contract()).resolved;
    const { draft } = await (await invoice.POST(request("invoice-draft"))).json();
    expect(draft.session).toEqual(fromContract.session);
    expect(draft.pricing).toEqual(fromContract.pricing);
    expect(mocks.claudeCalls).toBe(2);
  });

  it("says what could not be read instead of claiming nothing was chosen", async () => {
    mocks.tokens = null;
    const offline = await contract();
    expect(offline.email_status).toBe("unavailable");
    expect(offline.resolved.reviewReasons.join(" ")).toMatch(/Gmail is not connected/);
    mocks.tokens = { access_token: "tok", refresh_token: null, expiry_date: 0, email: "studio@example.test" };
    mocks.claudeText = "I could not find anything useful.";
    const unparsed = await contract();
    expect(unparsed.email_status).toBe("unparsed");
    expect(unparsed.resolved.reviewReasons.join(" ")).toMatch(/could not be interpreted/);
  });
});
