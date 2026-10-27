// A draft restored from storage gets the same pricing check as a fresh one.
//
// /api/admin/drafts used to return only the saved text. PricingCheck runs only
// when it is handed the rate card's inputs, so a stored draft quoting the old
// $70 SJSU travel fee restored with no check at all. The route now computes
// those inputs from the inquiry row, with no model call.

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildQuoteInputForInquiry } from "@/lib/ai/inquiryQuote";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { quoteInputOf } from "@/lib/ai/validateEmailDraft";
import { checkDraftQuote, type QuoteInput } from "@/lib/ai/quotePricing";
import { AVAILABILITY, NOW, inquiry } from "./fixtures";

const SJSU_ROW = {
  session_type: "Graduation", message: "Hi! I'd love to book graduation photos.",
  school: "San Jose State University", location: null, people: 1,
};
const OLD_DRAFT = "Hi Sarah,\n\nMy sessions start at $350, plus a $70 travel fee for SJSU, so $420 total";

const mocks = vi.hoisted(() => ({
  inquiry: null as Record<string, unknown> | null,
  settings: [] as { key: string; value: string }[],
}));

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async () => ({ data: mocks.settings, error: null }),
        eq: () => ({ maybeSingle: async () => ({ data: table === "inquiries" ? mocks.inquiry : null, error: null }) }),
      }),
    }),
  }),
}));

const { GET } = await import("@/app/api/admin/drafts/route");

async function restore(inquiryId = 136) {
  const response = await GET(new NextRequest(`https://soloxsnaps.com/api/admin/drafts?inquiryId=${inquiryId}`));
  return await response.json() as { ai_draft: string | null; quote: { input: QuoteInput; stalePrices: number[] } | null };
}

describe("buildQuoteInputForInquiry", () => {
  it("matches what a fresh draft is checked against", () => {
    const fresh = quoteInputOf(buildEmailContext({
      inquiry: inquiry({ school: SJSU_ROW.school, people: 1 }),
      messages: [], availability: AVAILABILITY, threadLoaded: true, now: NOW,
    }));
    expect(buildQuoteInputForInquiry(SJSU_ROW).input).toEqual({ ...fresh, people: "1" });
  });

  it("flags a stored $70 SJSU draft against the approved $75 fee", () => {
    const check = checkDraftQuote(OLD_DRAFT, buildQuoteInputForInquiry(SJSU_ROW).input);
    expect(check.mismatches.map((m) => [m.stated, m.expected])).toEqual([[70, 75], [420, 425]]);
  });

  it("prices nothing for a session the rate card does not cover", () => {
    const { input, facts } = buildQuoteInputForInquiry({ sessionType: "Headshots", message: "Need a headshot" });
    expect(facts.verified).toBe(false);
    expect(input.basePrices).toEqual([]);
  });
});

describe("GET /api/admin/drafts", () => {
  it("returns the quote inputs with a restored draft", async () => {
    mocks.inquiry = SJSU_ROW;
    mocks.settings = [{ key: "ai_draft_136", value: OLD_DRAFT }];
    const body = await restore();
    expect(body.ai_draft).toBe(OLD_DRAFT);
    expect(body.quote?.input.travel).toMatchObject({ kind: "verified", fee: 75 });
    expect(checkDraftQuote(body.ai_draft!, body.quote!.input).mismatches).toHaveLength(2);
  });

  it("still returns the drafts when the inquiry row is missing", async () => {
    mocks.inquiry = null;
    mocks.settings = [{ key: "draft_136", value: "Hi Sarah" }];
    const body = await restore();
    expect(body.quote).toBeNull();
  });
});
