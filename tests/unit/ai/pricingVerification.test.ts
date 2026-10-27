// Draft AI never treats its own arithmetic as the price: the quote is computed
// from the rate card, the draft is checked against it, and an older email's
// figure cannot outrank today's approved fee without the admin confirming it.

import { describe, expect, it } from "vitest";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { validateEmailDraft, quoteInputOf } from "@/lib/ai/validateEmailDraft";
import { authoritativeQuote, checkDraftQuote, correctDraftPricing, enforceDraftPricing } from "@/lib/ai/quotePricing";
import { generateDraft } from "@/lib/ai/emailOperations";
import { AVAILABILITY, NOW, fakeCaller, inquiry, message } from "./fixtures";

function sjsu(opts: { people?: number; thread?: ReturnType<typeof message>[]; confirmed?: number[] } = {}) {
  return buildEmailContext({
    inquiry: inquiry({ school: "San Jose State University", people: opts.people ?? 1 }),
    messages: opts.thread ?? [],
    availability: AVAILABILITY,
    threadLoaded: true,
    confirmedPrices: opts.confirmed,
    now: NOW,
  });
}

const types = (draft: string, context: ReturnType<typeof sjsu>) =>
  validateEmailDraft(draft, context).issues.map((i) => i.type);

const OLD_DRAFT = "Hi Sarah,\n\nMy graduation sessions at San Jose State start at $350 for a 1-hour session, plus a $70 travel fee for SJSU, so $420 total";
const GOOD_DRAFT = "Hi Sarah,\n\nMy graduation sessions at San Jose State start at $350 for a 1-hour session, plus a $75 travel fee for SJSU, so $425 total";

describe("the authoritative breakdown", () => {
  it("is $350 + $75 = $425 for one SJSU graduate", () => {
    expect(authoritativeQuote(quoteInputOf(sjsu()))).toEqual({
      lines: [
        { kind: "session", label: "Graduation session", amount: 350 },
        { kind: "travel", label: "SJSU travel fee", amount: 75 },
      ],
      total: 425,
    });
  });

  it("is $600 + $75 = $675 for two", () => {
    const quote = authoritativeQuote(quoteInputOf(sjsu({ people: 2 })));
    expect(quote?.lines.map((l) => l.amount)).toEqual([600, 75]);
    expect(quote?.total).toBe(675);
  });

  it("is reported only when the draft quotes a price", () => {
    expect(checkDraftQuote("Hi Sarah,\n\nOctober 26th works!", quoteInputOf(sjsu())).quotesPrice).toBe(false);
  });
});

describe("validation against the approved fee", () => {
  it("flags the old $70 fee and $420 total before the draft counts as verified", () => {
    const result = validateEmailDraft(OLD_DRAFT, sjsu());
    const mismatches = result.issues.filter((i) => i.type === "pricing_mismatch");
    expect(mismatches.map((i) => i.description)).toEqual([
      "States a $70 travel fee; the verified fee is $75.",
      "States a $420 total; the rate card gives $425.",
    ]);
    expect(result.factsVerified).toBe(false);
    expect(result.valid).toBe(false);
  });

  it("passes the correct quote, single and group", () => {
    expect(types(GOOD_DRAFT, sjsu())).not.toContain("pricing_mismatch");
    expect(types(GOOD_DRAFT, sjsu())).not.toContain("unsupported_price");
    const group = "Hi Sarah,\n\nFor two graduates that's $600, plus a $75 travel fee for SJSU, so $675 total";
    expect(types(group, sjsu({ people: 2 }))).toEqual([]);
  });

  it("keeps add-ons valid on top of the travel fee", () => {
    const draft = "Hi Sarah,\n\nThat's $350 plus $75 for the extra outfit and a $75 travel fee, so $500 total";
    expect(types(draft, sjsu())).not.toContain("pricing_mismatch");
  });

  it("corrects only the wrong figures", () => {
    const check = checkDraftQuote(OLD_DRAFT, quoteInputOf(sjsu()));
    expect(correctDraftPricing(OLD_DRAFT, check)).toBe(GOOD_DRAFT);
  });

  it("flags any travel amount for a shoot inside San Francisco", () => {
    const sf = buildEmailContext({
      inquiry: inquiry({ school: "San Jose State University", location: "Palace of Fine Arts" }),
      messages: [], availability: AVAILABILITY, threadLoaded: true, now: NOW,
    });
    expect(types("Hi Sarah,\n\nIt's $350 plus a $75 travel fee", sf)).toContain("pricing_mismatch");
  });
});

describe("server-side correction", () => {
  const generate = (reply: string, overrides: Parameters<typeof inquiry>[0] = {}) => generateDraft({
    inquiry: inquiry({ school: "San Jose State University", people: 1, ...overrides }),
    messages: [], availability: AVAILABILITY, threadLoaded: true, now: NOW, rules: [], threadText: null,
  }, fakeCaller(reply));

  it("puts the approved fee and total into a draft that quoted $70 SJSU travel", async () => {
    const result = await generate(OLD_DRAFT);
    expect(result.draft).toBe(GOOD_DRAFT);
    expect(result.pricing.originalDraft).toBe(OLD_DRAFT);
    expect(result.pricing.corrections.map((c) => [c.kind, c.stated, c.expected])).toEqual([["travel", 70, 75], ["total", 420, 425]]);
    expect(result.validation.issues.map((i) => i.type)).not.toContain("pricing_mismatch");
  });

  it("changes nothing when the figures are right", async () => {
    const result = await generate(GOOD_DRAFT);
    expect(result.draft).toBe(GOOD_DRAFT);
    expect(result.pricing).toEqual({ originalDraft: null, corrections: [] });
  });

  it("leaves an unverifiable travel amount flagged rather than guessing one", async () => {
    const draft = "Hi Sarah,\n\nA couples session is $450, plus a $90 travel fee for Point Reyes, so $540 total";
    const result = await generate(draft, { sessionType: "Couples", school: null, location: "Point Reyes" });
    expect(result.draft).toBe(draft);
    expect(result.pricing.corrections).toEqual([]);
    const mismatch = result.validation.issues.find((i) => i.type === "pricing_mismatch");
    expect(mismatch?.description).toContain("no travel amount is verified");
  });

  it("does not rewrite a total the rate card can only guess at", () => {
    const check = checkDraftQuote("Hi Sarah,\n\nIt's $350 plus a $75 travel fee for SJSU, so $480 total", quoteInputOf(sjsu()));
    expect(check.mismatches).toEqual([expect.objectContaining({ kind: "total", stated: 480, certain: false })]);
    expect(enforceDraftPricing("so $480 total for SJSU with a $75 travel fee", quoteInputOf(sjsu())).corrections).toEqual([]);
  });
});

describe("an older email's figure", () => {
  const oldQuote = message("My sessions start at $350, plus a $70 travel fee for SJSU, so $420 total", true, 5);

  it("does not override the approved fee", () => {
    const context = sjsu({ thread: [oldQuote] });
    expect(context.pricing.stalePrices.sort()).toEqual([420, 70]);
    expect(context.warnings.map((w) => w.code)).toContain("stale_quoted_price");
    expect(context.thread.lines.join("\n")).not.toMatch(/Do not contradict these[^\n]*\$420/);
    expect(types("Hi Sarah,\n\nYes, it's still $420", context)).toContain("unsupported_price");
    expect(validateEmailDraft(GOOD_DRAFT, context).factsVerified).toBe(true);
  });

  it("stands when the admin confirms it was agreed for this client", () => {
    const context = sjsu({ thread: [oldQuote], confirmed: [70, 420] });
    expect(context.pricing.stalePrices).toEqual([]);
    expect(context.warnings.map((w) => w.code)).not.toContain("stale_quoted_price");
    expect(types("Hi Sarah,\n\nYes, it's still $420 with the $70 travel fee", context)).not.toContain("pricing_mismatch");
  });

  it("leaves a deliberate custom price alone", () => {
    const context = sjsu({ thread: [message("I can do $275 given the short notice", true, 3)] });
    expect(context.pricing.stalePrices).toEqual([]);
    expect(types("Hi Sarah,\n\nStill $275 as we discussed", context)).not.toContain("unsupported_price");
  });
});
