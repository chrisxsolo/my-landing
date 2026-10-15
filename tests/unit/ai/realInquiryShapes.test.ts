// ─────────────────────────────────────────────────────────────────────────────
// Regressions found by drafting against real inquiries from the database.
//
// Every case here is a shape that actually occurred, with the client's own
// wording paraphrased. Fixtures I invented shared my assumptions about what an
// inquiry looks like; these did not.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { resolvePlaybookKey } from "@/lib/ai/soloxsnapsWritingProfile";
import { buildPricingFacts } from "@/lib/ai/businessFacts";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { validateEmailDraft } from "@/lib/ai/validateEmailDraft";
import { AVAILABILITY, NOW, inquiry } from "./fixtures";

describe('the form\'s "Other" option hides real session types', () => {
  const cases: [string, string, string][] = [
    ["proposal", "Other", "This is an engagement shoot as I am going to propose."],
    ["proposal", "Other", "how much it would cost to have photography and videography on my sisters proposal"],
    ["graduation", "Other", "I would love to do multiple locations for my graduation pictures."],
    ["engagement", "Other", "My fiancée and I are looking to have some engagement photos taken"],
  ];

  it.each(cases)('resolves to %s instead of asking what they want', (expected, type, message) => {
    expect(resolvePlaybookKey(type, message)).toBe(expected);
  });
});

describe("a message more specific than the dropdown wins", () => {
  // Filed "Couples Session", but they are proposing. Taking the dropdown
  // loaded the couples playbook and priced it as a $650 engagement session
  // instead of a $750 proposal.
  const message = "This is for engagement photos, I'd love to ask her in the Muir Woods";

  it("resolves a proposal described as engagement photos", () => {
    expect(resolvePlaybookKey("Couples Session", message)).toBe("proposal");
  });

  it("prices it as a proposal, not an engagement session", () => {
    const facts = buildPricingFacts({ sessionType: "Couples Session", message });
    expect(facts.lines.join(" ")).toContain("$750");
    expect(facts.lines.join(" ")).not.toContain("$650");
  });

  it("still trusts a dropdown that is already the more specific one", () => {
    expect(resolvePlaybookKey("Proposal Session", "we want couples photos after")).toBe("proposal");
  });

  it("corrects a graduation shoot filed as Individual Portrait", () => {
    expect(resolvePlaybookKey("Individual Portrait", "Session type: Graduation Portrait, CSU East Bay"))
      .toBe("graduation");
  });
});

describe("a passing mention does not hijack the session type", () => {
  // A commercial inquiry about a restaurant CEO resolved to "family" because
  // the word appeared in "family-owned restaurant brands".
  it("ignores an incidental 'family' in a commercial inquiry", () => {
    const message = "a photography opportunity for a Bay Area restaurant executive, founder of several family-owned restaurant brands, for a magazine cover";
    expect(resolvePlaybookKey("Other", message)).not.toBe("family");
  });

  it("still catches a genuine family inquiry", () => {
    expect(resolvePlaybookKey("Other", "Our family is in town for a funeral, 8 adults and 3 children"))
      .toBe("family");
  });

  it("ignores an incidental 'opening' or 'party' in free text", () => {
    expect(resolvePlaybookKey("Other", "we are opening up to the idea of a party afterwards"))
      .not.toBe("event");
  });

  it("still catches a genuine event inquiry", () => {
    expect(resolvePlaybookKey("Event Coverage", "friend's first art exhibit")).toBe("event");
    expect(resolvePlaybookKey("Other", "pictures of my friend's first art exhibit")).toBe("event");
  });
});

describe("event coverage reaches the rate card", () => {
  it("was previously dropped entirely despite being priced", () => {
    const facts = buildPricingFacts({ sessionType: "Event Coverage", message: "art exhibit" });
    expect(facts.verified).toBe(true);
    expect(facts.lines.join(" ")).toContain("$500 per hour");
    expect(facts.lines.join(" ")).toContain("2-hour minimum");
  });

  it("flags that the final figure needs confirming, since it depends on hours", () => {
    const facts = buildPricingFacts({ sessionType: "Event Coverage", message: "art exhibit" });
    expect(facts.needsManualQuote).toMatch(/hours, venue, and travel/i);
  });
});

describe("dates the client supplied are not flagged as invented", () => {
  function ctxWith(overrides: Parameters<typeof inquiry>[0]) {
    return buildEmailContext({
      inquiry: inquiry(overrides),
      messages: [],
      availability: AVAILABILITY,
      threadLoaded: true,
      now: NOW,
    });
  }

  it("accepts a date written in the inquiry form message", () => {
    // The form message is not part of the Gmail thread, so these dates never
    // reached the thread digest and a correct reply got flagged.
    const context = ctxWith({ message: "We need the final assets by September 1, is that possible?" });
    const draft = "Hi Sarah,\n\nSeptember 1st is earlier than my open dates, so I don't think I can make that work";
    expect(validateEmailDraft(draft, context).issues.map((i) => i.type))
      .not.toContain("unsupported_date");
  });

  it("accepts an abbreviated month in date_in_mind", () => {
    const context = ctxWith({ dateInMind: "Jul 19 (will get back to you on time)" });
    const draft = "Hi Sarah,\n\nI can't say yes or no to July 19th yet, but I'll confirm as soon as I can";
    expect(validateEmailDraft(draft, context).issues.map((i) => i.type))
      .not.toContain("unsupported_date");
  });

  it("still flags a date nobody mentioned and nothing supports", () => {
    const context = ctxWith({ message: "Looking for grad photos" });
    const draft = "Hi Sarah,\n\nHow about February 14th?";
    expect(validateEmailDraft(draft, context).issues.map((i) => i.type))
      .toContain("unsupported_date");
  });
});
