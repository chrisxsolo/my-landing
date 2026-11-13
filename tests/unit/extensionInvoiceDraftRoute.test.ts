// /api/extension/invoice-draft end to end with Supabase, the thread facts and
// the sunset lookup mocked: the route looks sunset up by date alone, builds
// the draft from it, and a lookup that fails never fails the draft.
// Everything here is synthetic.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NO_FACTS, type SessionFacts } from "@/lib/invoiceDraft/types";

const SECRET = "test-extension-secret";

const mocks = vi.hoisted(() => {
  process.env.CRON_SECRET = "test-extension-secret";
  return {
    facts: null as unknown,
    inquiry: null as Record<string, unknown> | null,
    fetched: [] as string[],
    sunsetBody: null as unknown,
    sunsetDown: false,
  };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.inquiry, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/extension/sessionFacts", () => ({ sessionFactsForInquiry: async () => mocks.facts }));

vi.stubGlobal("fetch", async (url: string | URL) => {
  mocks.fetched.push(String(url));
  if (mocks.sunsetDown) throw new Error("network down");
  return Response.json(mocks.sunsetBody);
});

const route = await import("@/app/api/extension/invoice-draft/route");
const { clearSunsetCache } = await import("@/lib/invoiceDraft/sunset");

const post = (body: unknown, secret: string | null = SECRET) => route.POST(new NextRequest("http://localhost/api/extension/invoice-draft", {
  method: "POST", body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...(secret ? { "x-extension-secret": secret } : {}) },
}));

const facts = (over: Partial<SessionFacts>): SessionFacts => ({
  ...NO_FACTS, source: "email", date_status: "confirmed", total_status: "confirmed", email_status: "read",
  date: "2027-04-24", location: "Palace of Fine Arts", time: "golden hour", time_status: "proposed", ...over,
});

beforeEach(() => {
  clearSunsetCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.fetched = [];
  mocks.sunsetDown = false;
  mocks.inquiry = {
    id: 9001, name: "Avery Example", email: "avery@example.test", school: "California State University, East Bay",
    location: null, people: "1", session_type: "Graduation Portrait", message: "Hi! I'd love grad photos this spring.", date_in_mind: "April 24",
  };
  mocks.facts = facts({});
  mocks.sunsetBody = {
    geometry: { type: "Point", coordinates: [-122.4194, 37.7749] },
    properties: { data: { year: 2027, month: 4, day: 24, tz: -7, sundata: [{ phen: "Set", time: "19:54" }] } },
  };
});

describe("invoice-draft", () => {
  it("rejects a missing or wrong extension secret before reading anything", async () => {
    expect((await post({ inquiry_id: 9001 }, null)).status).toBe(401);
    expect((await post({ inquiry_id: 9001 }, "nope")).status).toBe(401);
    expect(mocks.fetched).toEqual([]);
  });

  it("returns a ready $425 draft with the calculated window and the published sunset", async () => {
    const res = await post({ inquiry_id: 9001 });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const { draft, facts: returned } = await res.json();
    expect(draft).toMatchObject({
      status: "ready", reviewReasons: [], dueDate: "2027-04-24",
      session: {
        itemName: "Graduation Session", time: "6:30–7:30 pm", durationMinutes: 60, packageSource: "default",
        packageNote: "Default: 60-minute Graduation Session", location: "Palace of Fine Arts", date: "2027-04-24",
        timeDetail: { status: "calculated", zoneAbbreviation: "PDT", sunset: { local: "7:54 pm", source: "US Naval Observatory" } },
      },
      pricing: { baseCents: 42500, totalCents: 42500, travel: { kind: "included", amountCents: 0 } },
    });
    expect(returned.time).toBe("golden hour");
  });

  it("sends the sunset provider a date and coordinates and nothing about the client", async () => {
    await post({ inquiry_id: 9001 });
    expect(mocks.fetched).toEqual(["https://aa.usno.navy.mil/api/rstt/oneday?date=2027-04-24&coords=37.7749,-122.4194&tz=-7"]);
    expect(mocks.fetched.join(" ")).not.toMatch(/avery|example\.test|9001|Palace/i);
  });

  it("still answers, from the labelled calculation, when the provider is down", async () => {
    mocks.sunsetDown = true;
    const res = await post({ inquiry_id: 9001 });
    expect(res.status).toBe(200);
    const { draft } = await res.json();
    expect(draft.status).toBe("ready");
    expect(draft.session.timeDetail).toMatchObject({ status: "calculated", sunset: { source: expect.stringMatching(/^calculated sunset/) } });
    expect(draft.pricing.totalCents).toBe(42500);
  });

  it("does not look sunset up when the thread asked for no time", async () => {
    mocks.facts = facts({ time: null, time_status: null });
    const { draft } = await (await post({ inquiry_id: 9001 })).json();
    expect(mocks.fetched).toEqual([]);
    expect(draft).toMatchObject({ status: "ready", session: { time: null, timeDetail: { status: "none" } } });
  });

  it("leaves the time unresolved, with the price intact, when the date is only tentative", async () => {
    mocks.facts = facts({ date_status: "proposed" });
    const { draft } = await (await post({ inquiry_id: 9001 })).json();
    expect(draft.status).toBe("review");
    expect(draft.session.time).toBeNull();
    expect(draft.pricing.totalCents).toBe(42500);
    expect(draft.dueDate).toBeNull();
  });
});
