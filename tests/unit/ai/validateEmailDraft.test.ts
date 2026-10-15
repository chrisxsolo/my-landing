import { describe, it, expect } from "vitest";
import { validateEmailDraft } from "@/lib/ai/validateEmailDraft";
import { stripParagraphPeriods } from "@/lib/ai/emailOperations";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { AVAILABILITY, NOW, inquiry, message, GOOD_DRAFT } from "./fixtures";

function ctx(messages: ReturnType<typeof message>[] = [], overrides = {}) {
  return buildEmailContext({
    inquiry: inquiry(overrides),
    messages,
    availability: AVAILABILITY,
    threadLoaded: true,
    now: NOW,
  });
}

describe("format rules", () => {
  const cases: [string, string, string][] = [
    ["em_dash", "Hi Sarah,\n\nI'm free Monday — or Tuesday works", "em dash"],
    ["uppercase_meridiem", "Hi Sarah,\n\nHow about 5:30 PM on the 26th", "uppercase pm"],
    ["markdown_formatting", "Hi Sarah,\n\n**Pricing** is simple", "markdown"],
    ["emoji", "Hi Sarah,\n\nCan't wait 📸", "emoji"],
  ];

  it.each(cases)("flags %s (%s)", (type, draft) => {
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type)).toContain(type);
  });

  it("flags a sign-off, because Gmail already adds one", () => {
    const draft = "Hi Sarah,\n\nSounds great!\n\nBest,\nChris";
    const result = validateEmailDraft(draft, ctx());
    expect(result.issues.map((i) => i.type)).toContain("signature_present");
    expect(result.valid).toBe(false);
  });

  it("flags a bulleted availability list", () => {
    const draft = "Hi Sarah,\n\nI'm open:\n- October 26th\n- October 28th";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type)).toContain("bullet_list");
  });

  it("flags corporate boilerplate", () => {
    const draft = "Hi Sarah,\n\nI hope this email finds you well. Please advise which date works";
    const types = validateEmailDraft(draft, ctx()).issues.filter((i) => i.type === "banned_phrase");
    expect(types).toHaveLength(2);
  });

  it("flags a missing greeting", () => {
    expect(validateEmailDraft("Thanks for reaching out!", ctx()).issues.map((i) => i.type))
      .toContain("missing_greeting");
  });

  it("passes a clean draft", () => {
    const result = validateEmailDraft(GOOD_DRAFT, ctx());
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("price support", () => {
  it("accepts an exact rate-card price", () => {
    const draft = "Hi Sarah,\n\nMy graduation session is $350 per hour";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .not.toContain("unsupported_price");
  });

  it("accepts a base plus add-ons, which is a real total", () => {
    // 350 base + 75 extra outfit
    const draft = "Hi Sarah,\n\nWith the second outfit that comes to $425";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .not.toContain("unsupported_price");
  });

  it("rejects a sum of add-ons with no session base", () => {
    // 100 extra-30-min + 75 extra-outfit happens to make 175, but add-ons are
    // never sold on their own, so this is not a quotable total.
    const draft = "Hi Sarah,\n\nI could do $175 for you";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .toContain("unsupported_price");
  });

  it("rejects an invented round number", () => {
    const draft = "Hi Sarah,\n\nI can do $200 flat";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .toContain("unsupported_price");
  });

  it("accepts a price already quoted in the thread, add-ons included", () => {
    const withQuote = ctx([message("I can do $275 given the short notice", true, 3)]);
    const draft = "Hi Sarah,\n\nStill $275 as we discussed";
    expect(validateEmailDraft(draft, withQuote).issues.map((i) => i.type))
      .not.toContain("unsupported_price");
  });
});

describe("date support", () => {
  it("accepts dates on the open list", () => {
    const draft = "Hi Sarah,\n\nI'm available October 26th or October 28th!";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .not.toContain("unsupported_date");
  });

  it("rejects a date that is open on no calendar", () => {
    const draft = "Hi Sarah,\n\nHow about November 15th?";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .toContain("unsupported_date");
  });

  it("allows a booked date the client raised, so it can be declined", () => {
    const withRequest = ctx([], { dateInMind: "2026-10-18" });
    const draft = "Hi Sarah,\n\nI'm not available October 18th, but October 26th is open!";
    expect(validateEmailDraft(draft, withRequest).issues.map((i) => i.type))
      .not.toContain("unsupported_date");
  });
});

describe("booking state", () => {
  it("rejects claiming the session is confirmed with no deposit", () => {
    const draft = "Hi Sarah,\n\nYour session is confirmed!";
    expect(validateEmailDraft(draft, ctx()).issues.map((i) => i.type))
      .toContain("fabricated_payment");
  });

  it("accepts a confirmation once the deposit is evident", () => {
    const paid = ctx([message("Just paid the deposit!", false, 1)]);
    const draft = "Hi Sarah,\n\nYour session is confirmed!\n\nSee you October 26th!";
    expect(validateEmailDraft(draft, paid).issues.map((i) => i.type))
      .not.toContain("fabricated_payment");
  });
});

describe("truncation", () => {
  it("refuses a draft cut off at the token limit", () => {
    const result = validateEmailDraft(GOOD_DRAFT, ctx(), "max_tokens");
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.type)).toContain("truncated");
  });
});

describe("needsReview", () => {
  it("is true when context could not be verified, even on a clean draft", () => {
    const unverified = buildEmailContext({
      inquiry: inquiry(),
      messages: [],
      availability: null, // availability could not be read
      threadLoaded: true,
      now: NOW,
    });
    const result = validateEmailDraft("Hi Sarah,\n\nThanks for reaching out!", unverified);
    expect(result.needsReview).toBe(true);
  });
});

describe("paragraph periods", () => {
  // The rule was in the permanent profile from the start but nothing enforced
  // it. A live eval produced "I'd love to capture this for you." repeatedly.
  it("strips the period from the end of a paragraph", () => {
    const drafted = "Hi Sarah,\n\nI'd love to shoot your graduation photos.\n\nLet me know which date works.";
    expect(stripParagraphPeriods(drafted)).toBe(
      "Hi Sarah,\n\nI'd love to shoot your graduation photos\n\nLet me know which date works",
    );
  });

  it("leaves question and exclamation marks alone", () => {
    const drafted = "Hi Sarah,\n\nWhich date works best?\n\nLooking forward to hearing back from you!";
    expect(stripParagraphPeriods(drafted)).toBe(drafted);
  });

  it("keeps periods inside a paragraph", () => {
    const drafted = "Hi Sarah,\n\nThe session is $350. It includes 50+ images";
    expect(stripParagraphPeriods(drafted)).toBe(drafted);
  });

  it("does not mangle an abbreviation at the end of a paragraph", () => {
    const drafted = "Hi Sarah,\n\nI shoot all over the U.S.";
    expect(stripParagraphPeriods(drafted)).toBe(drafted);
  });

  it("flags a survivor at low severity rather than blocking the draft", () => {
    const result = validateEmailDraft("Hi Sarah,\n\nI shoot all over the U.S.", ctx());
    const issue = result.issues.find((i) => i.type === "paragraph_period");
    expect(issue?.severity).toBe("low");
    expect(result.valid).toBe(true);
  });

  it("passes a draft already written the way Chris writes", () => {
    const result = validateEmailDraft(GOOD_DRAFT, ctx());
    expect(result.issues.map((i) => i.type)).not.toContain("paragraph_period");
  });
});
