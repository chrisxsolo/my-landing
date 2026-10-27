// Contract generation for an elopement, with Supabase, Gmail and Claude
// mocked. No network call and no model call is made.
//
// The contract is the only place a client sees the image minimum in writing, so
// it has to agree with the rates page and the email assistant. Before the
// elopement entry existed, `getMinimumImageCountForSessionType` fell through to
// the 30-image event default and the contract silently promised the wrong
// number.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";

const mocks = vi.hoisted(() => ({
  inquiry: {} as Record<string, unknown>,
  extracted: "{}",
}));

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
// No Gmail token, so the route skips the thread fetch entirely.
vi.mock("@/lib/gmailTokens", () => ({ getValidTokens: async () => null }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: mocks.inquiry }) }) }),
    }),
  }),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: async () => ({ content: [{ type: "text", text: mocks.extracted }] }) };
  },
}));

const { POST } = await import("@/app/api/generate-contract/route");

async function generateWithPricing(): Promise<{ contract: string; pricing?: { status: string; reason?: string } }> {
  const response = await POST(new NextRequest("https://soloxsnaps.com/api/generate-contract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inquiry_id: 4242 }),
  }));
  const body = await response.json() as { contract?: string; pricing?: { status: string; reason?: string } };
  return { contract: body.contract ?? "", pricing: body.pricing };
}

async function generate(): Promise<string> {
  return (await generateWithPricing()).contract;
}

const ELOPEMENT_INQUIRY = {
  id: 4242,
  name: "Maya Ortiz",
  email: "maya.ortiz@example.com",
  session_type: "Elopement / Courthouse Ceremony",
  session_date: "2027-03-14",
  date_in_mind: "March 14",
  message: "Our courthouse ceremony starts at 3:30 pm, we'd love the ceremony covered plus family portraits",
  school: null,
  location: "San Francisco City Hall",
};

beforeEach(() => {
  mocks.inquiry = { ...ELOPEMENT_INQUIRY };
  mocks.extracted = JSON.stringify({ agreedTotal: 950, sessionTime: "3:00pm-5:00pm", location: "San Francisco City Hall" });
});

describe("an elopement contract", () => {
  it("promises the catalog's image minimum, not the event default", async () => {
    const contract = await generate();
    expect(contract).toContain(`Minimum of ${PRICING_CATALOG.elopement.minimumImages} edited images`);
    expect(contract).not.toContain(`Minimum of ${PRICING_CATALOG.events.smallEvent.minimumImages} edited images`);
  });

  it("carries the session type and the agreed figures", async () => {
    const contract = await generate();
    expect(contract).toContain("Elopement / Courthouse Ceremony");
    expect(contract).toContain("$950");
    // 50% retainer of the agreed total, from the one booking policy.
    expect(contract).toContain("$475");
  });

  it("does not add a graduation travel fee to a city hall ceremony", async () => {
    const contract = await generate();
    expect(contract).not.toContain("$993.50");
  });

  it("leaves other services on their own minimums", async () => {
    mocks.inquiry = { ...ELOPEMENT_INQUIRY, session_type: "Graduation Portrait", message: "SJSU grad photos" };
    const gradContract = await generate();
    expect(gradContract).toContain(`Minimum of ${PRICING_CATALOG.graduation.standardMinimumImages} edited images`);

    mocks.inquiry = { ...ELOPEMENT_INQUIRY, session_type: "Family Session", message: "family photos for five" };
    const familyContract = await generate();
    expect(familyContract).toContain(`Minimum of ${PRICING_CATALOG.families.packages.standard.minimumImages} edited images`);
  });
});

describe("an SJSU graduation contract", () => {
  const SJSU = { ...ELOPEMENT_INQUIRY, session_type: "Graduation", school: "San Jose State University", location: null, message: "SJSU grad photos" };

  it("keeps an agreed $425 all-in total at $425, not $500", async () => {
    mocks.inquiry = SJSU;
    mocks.extracted = JSON.stringify({ agreedTotal: 425, sessionPrice: 350, travelFee: 75, includesTravel: true });
    const contract = await generate();
    expect(contract).toContain("$425");
    expect(contract).toContain("$212.50");
    expect(contract).not.toContain("$500");
  });

  it("adds the approved $75 travel fee to a bare $350 session price", async () => {
    mocks.inquiry = SJSU;
    mocks.extracted = JSON.stringify({ sessionPrice: 350 });
    expect(await generate()).toContain("$425");
  });

  it("asks for review instead of guessing whether $350 includes travel", async () => {
    mocks.inquiry = SJSU;
    mocks.extracted = JSON.stringify({ agreedTotal: 350 });
    const { contract, pricing } = await generateWithPricing();
    expect(pricing?.status).toBe("review");
    expect(contract).toContain("[TOTAL FEE — review the price]");
  });
});
