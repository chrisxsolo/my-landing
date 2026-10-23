// Route-level test for an elopement inquiry, with Supabase, Resend and the
// funnel event mocked. Nothing leaves the process: no row is written to the
// real database and no email is sent.
//
// What it guards: the session type the form offers reaches the inquiries table
// verbatim, every other field still lands with it, and the stored row prices as
// an elopement everywhere downstream. The row shape is the contract between the
// form, the AI assistant, the contract generator and the revenue dashboard, so
// a silent rename of the dropdown value would break all four.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolvePlaybookKey } from "@/lib/ai/sessionClassifier";
import { buildPricingFacts } from "@/lib/ai/businessFacts";
import { normalizeService } from "@/lib/revenue/enrich";
import { getMinimumImageCountForSessionType, PRICING_CATALOG } from "@/lib/pricingCatalog";

const mocks = vi.hoisted(() => ({
  inserts: [] as { table: string; values: Record<string, unknown> }[],
  updates: [] as { table: string; values: Record<string, unknown> }[],
  events: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: (table: string) => ({
      // The email cooldown check: no earlier inquiry from this address.
      select: () => ({
        ilike: () => ({ gte: () => ({ order: async () => ({ data: [] }) }) }),
      }),
      insert: (values: Record<string, unknown>) => {
        mocks.inserts.push({ table, values });
        return { select: () => ({ single: async () => ({ data: { id: 4242 }, error: null }) }) };
      },
      // The route stamps the row after trying to send mail.
      update: (values: Record<string, unknown>) => {
        mocks.updates.push({ table, values });
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));
vi.mock("@/lib/contentEngine/recordEvent", () => ({
  recordContentEvent: async (_client: unknown, event: Record<string, unknown>) => {
    mocks.events.push(event);
  },
}));
// Resend is never constructed without RESEND_API_KEY, and the test never sets
// it. Mocked anyway so a stray env var in a developer shell cannot send mail.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ data: null, error: new Error("mail disabled in tests") }) };
  },
}));

const { POST } = await import("@/app/api/contact/route");

const ELOPEMENT_TYPE = "Elopement / Courthouse Ceremony";

function submit(form: Record<string, unknown>) {
  return POST(new NextRequest("https://soloxsnaps.com/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
    // renderedAt older than the bot-timing floor, so the submission is accepted.
    body: JSON.stringify({ renderedAt: Date.now() - 30_000, website: "", ...form }),
  }));
}

const ELOPEMENT_FORM = {
  name: "Maya Ortiz",
  email: "maya.ortiz@example.com",
  phone: "415-555-0134",
  sessionType: ELOPEMENT_TYPE,
  people: "4",
  date: "March 14, flexible",
  preferredTime: "Late afternoon / golden hour",
  location: "San Francisco City Hall",
  instagram: "@mayaortiz",
  message: "Our courthouse ceremony starts at 3:30 pm. We'd love the ceremony covered plus portraits with my parents, and maybe a second spot nearby.",
};

beforeEach(() => {
  mocks.inserts.length = 0;
  mocks.updates.length = 0;
  mocks.events.length = 0;
});

describe("an elopement inquiry submits like any other", () => {
  it("stores the session type verbatim, with every other field intact", async () => {
    const response = await submit(ELOPEMENT_FORM);
    expect(response.status).toBe(200);

    const row = mocks.inserts.find((insert) => insert.table === "inquiries")?.values;
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      name: "Maya Ortiz",
      email: "maya.ortiz@example.com",
      phone: "415-555-0134",
      session_type: ELOPEMENT_TYPE,
      date_in_mind: "March 14, flexible",
      preferred_time: "Late afternoon / golden hour",
      people: "4",
      location: "San Francisco City Hall",
      instagram: "@mayaortiz",
      status: "new",
    });
    expect(row?.message).toContain("courthouse ceremony starts at 3:30 pm");
  });

  it("tags the funnel event with the elopement session type", async () => {
    await submit(ELOPEMENT_FORM);
    expect(mocks.events[0]).toMatchObject({
      event: "inquiry_submit",
      meta: { sessionType: ELOPEMENT_TYPE },
    });
  });

  it("still validates required fields", async () => {
    const response = await submit({ ...ELOPEMENT_FORM, email: "" });
    expect(response.status).toBe(400);
    expect(mocks.inserts).toEqual([]);
  });

  it("leaves an existing session type untouched", async () => {
    await submit({ ...ELOPEMENT_FORM, sessionType: "Couples Session", message: "Anniversary portraits for the two of us" });
    const row = mocks.inserts.find((insert) => insert.table === "inquiries")?.values;
    expect(row?.session_type).toBe("Couples Session");
  });
});

describe("the stored row prices as an elopement everywhere downstream", () => {
  it("classifies, prices, counts images and reports revenue as elopement", async () => {
    await submit(ELOPEMENT_FORM);
    const row = mocks.inserts.find((insert) => insert.table === "inquiries")?.values as {
      session_type: string; message: string; people: string;
    };

    expect(resolvePlaybookKey(row.session_type, row.message)).toBe("elopement");

    const facts = buildPricingFacts({
      sessionType: row.session_type, message: row.message, people: row.people,
    });
    expect(facts.basePrices).toEqual([PRICING_CATALOG.elopement.startingPrice]);
    expect(facts.addOnPrices).toEqual([PRICING_CATALOG.elopement.addOns.extraLocation.price]);

    expect(getMinimumImageCountForSessionType(row.session_type))
      .toBe(PRICING_CATALOG.elopement.minimumImages);
    expect(normalizeService(row.session_type, true)).toBe("elopement");
  });
});
