// ─────────────────────────────────────────────────────────────────────────────
// Classification regressions from the 57-inquiry evaluation.
//
// Every case is a shape that actually arrived. The wording is paraphrased from
// the real message, and the comment says what the old ordered first-match
// ranking did with it and what that cost.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { classifySession, resolvePlaybookKey } from "@/lib/ai/sessionClassifier";
import { buildPricingFacts } from "@/lib/ai/businessFacts";

describe("a proposal mentioned in passing is not a proposal booking", () => {
  it("prices a couples session that follows a proposal as a couples session", () => {
    // Quoted $750 against a client who wrote that they could not afford more
    // than the 30-minute session.
    const message =
      "interested in doing a short 30 min session. I plan to do my proposal shortly before and I would just like to do a couples session after. I dont think I can afford much more than the 30 min session";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("couples");
    const facts = buildPricingFacts({ sessionType: "Couples Session", message });
    // The $750 proposal rate is the error being guarded against. The session
    // packages are all quotable, and their wording points at the $350 mini.
    expect(facts.basePrices).not.toContain(750);
    expect(facts.basePrices).toContain(350);
    expect(facts.lines.join(" ")).toMatch(/points at the 30-Min Mini Session/);
  });

  it("treats a couple who missed photographing their own proposal as couples", () => {
    // They are already married and asked for an hour. Quoted $750.
    const message =
      "we recently got married Sept 4th but unfortunately we did not take pictures of our proposal or wedding so we'd love to book an hour session and make up for it";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("couples");
    const facts = buildPricingFacts({ sessionType: "Couples Session", message });
    expect(facts.basePrices).not.toContain(750);
    expect(facts.lines.join(" ")).toMatch(/points at the 1-Hour Session/);
  });

  it("keeps an engagement session at the engagement rate when a proposal is only speculative", () => {
    // "He might be proposing" is background. Quoted $750 for a $650 session.
    const message =
      "I was wondering how much it would be to do an engagement photoshoot for me and my boyfriend. He might be proposing in September";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("engagement");
    expect(buildPricingFacts({ sessionType: "Couples Session", message }).basePrices).toEqual([650]);
  });

  it("still catches a proposal the client is actually hiring for", () => {
    const cases = [
      "This is an engagement shoot as I am going to propose",
      "This is for engagement photos, I'd love to ask her in the Muir Woods",
      "Surprise proposal during a photo session (she thinks it's only a photo session)",
      "how much it would cost to have photography and videography on my sisters proposal",
      "I'm planning to propose to my girlfriend and want someone to capture the surprise",
    ];
    for (const message of cases) {
      expect(resolvePlaybookKey("Couples Session", message)).toBe("proposal");
    }
  });

  it("reads a surprise engagement shoot as a proposal", () => {
    // A surprise engagement shoot is a proposal: you cannot surprise a fiancée
    // with a session you planned together. Was quoted $650 instead of $750.
    const message =
      "any availability on Oct 9 to do either sunrise surprise engagement photoshoots or sunset? me and my girlfriend";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("proposal");
    expect(buildPricingFacts({ sessionType: "Couples Session", message }).basePrices).toEqual([750]);
  });
});

describe("a count of things is not a couple of people", () => {
  it("does not read 'a couple looks' as a couples session", () => {
    // A solo birthday portrait shoot, quoted $450 off the couples card for a
    // session that has no published rate at all.
    const message =
      "I'm hoping to book a portrait shoot for my birthday. I'd like to do a couple looks, both with an artistic fashion photography vibe";
    expect(resolvePlaybookKey("Individual Portrait", message)).toBe("portrait");
    expect(buildPricingFacts({ sessionType: "Individual Portrait", message }).verified).toBe(false);
  });

  it.each(["a couple of hours", "a couple outfits", "a couple more shots"])(
    "ignores %s",
    (phrase) => {
      expect(resolvePlaybookKey("Individual Portrait", `portrait session with ${phrase}`)).toBe("portrait");
    },
  );

  it("still catches a real couples session", () => {
    expect(resolvePlaybookKey("Other", "I would like to book some anniversary pictures for 30 min")).toBe("couples");
    expect(resolvePlaybookKey("Couples Session", "My wife and i would like a general couples session")).toBe("couples");
  });
});

describe("session types the rate card does not cover", () => {
  it("recognises a group headshot event instead of the group graduation rate", () => {
    // Filed as a graduation portrait. The group grad rate would have quoted
    // over $1,100; the real booking was a negotiated $600 flat.
    const message =
      "— Session request — Session type: Graduation Portrait School / Location: CSU East Bay Hi Chris! I'm a grad student and president of our social work graduate association. I'm working to organize a headshot event so my classmates can get professional photos";
    expect(resolvePlaybookKey("Individual Portrait", message)).toBe("headshot_event");
    const facts = buildPricingFacts({ sessionType: "Individual Portrait", message, people: "5+" });
    expect(facts.verified).toBe(false);
    expect(facts.basePrices).toEqual([]);
    expect(facts.needsManualQuote).toMatch(/per-person/i);
  });

  it("recognises commercial and editorial work", () => {
    const message =
      "I'm reaching out with a photography opportunity for a Bay Area restaurant executive, founder of several family-owned restaurant brands, for a magazine cover";
    expect(resolvePlaybookKey("Other", message)).toBe("commercial");
    expect(buildPricingFacts({ sessionType: "Other", message }).verified).toBe(false);
  });
});

describe("the dropdown is evidence, not an override", () => {
  it("loses to a more specific type described in the message", () => {
    expect(resolvePlaybookKey("Couples Session", "This is an engagement shoot as I am going to propose")).toBe("proposal");
    expect(resolvePlaybookKey("Individual Portrait", "I need professional headshots for my business website")).toBe("headshot");
  });

  it("wins when it is already the more specific one", () => {
    expect(resolvePlaybookKey("Proposal Session", "we want couples photos after")).toBe("proposal");
  });

  it("holds when the message only mentions another type in passing", () => {
    // "some with the family" does not turn a graduation into a family session.
    expect(resolvePlaybookKey("Graduation Portrait", "UC Berkeley grad photo, some solo shots and some with the family")).toBe("graduation");
    // "headshot like shots" does not turn it into a headshot session.
    expect(resolvePlaybookKey("Graduation Portrait", "Looking mostly for close up or headshot like shots")).toBe("graduation");
    // A graduate bringing their boyfriend is still a graduation.
    expect(resolvePlaybookKey("Graduation", "I'm graduating and want some pictures with my boyfriend")).toBe("graduation");
  });

  it("reads the estimator's own session line as an explicit choice", () => {
    expect(resolvePlaybookKey("Individual Portrait", "Session type: Graduation Portrait, CSU East Bay")).toBe("graduation");
  });
});

describe("event coverage", () => {
  it("recognises an event described without the booking vocabulary", () => {
    expect(resolvePlaybookKey("Other", "We're hosting a company celebration and need someone to photograph the event")).toBe("event");
    expect(resolvePlaybookKey("Other", "pictures of my friend's first art exhibit")).toBe("event");
    expect(resolvePlaybookKey("Event Coverage", "friend's first art exhibit")).toBe("event");
  });

  it("ignores an incidental party or opening", () => {
    expect(resolvePlaybookKey("Other", "we are opening up to the idea of a party afterwards")).not.toBe("event");
  });
});

describe("genuinely ambiguous requests are flagged rather than guessed", () => {
  it("flags a message asking request-grade for two unrelated sessions", () => {
    const result = classifySession(
      "Other",
      "I'd like graduation photos, and separately my family session for my parents' anniversary, family photos of the whole family",
    );
    expect(result.ambiguous).toBe(true);
    expect(result.alternative).not.toBeNull();
  });

  it("does not flag a dropdown that merely disagrees with the message", () => {
    // This is the normal case the classifier exists to resolve.
    const result = classifySession("Couples Session", "This is an engagement shoot as I am going to propose");
    expect(result.key).toBe("proposal");
    expect(result.ambiguous).toBe(false);
  });

  it("does not flag a refinement within the same group", () => {
    const result = classifySession("Individual Portrait", "lifestyle portraits and professional headshots for my brand");
    expect(result.ambiguous).toBe(false);
  });
});

describe("the couples card does not hide its own options", () => {
  it("offers all three session lengths when they ask about packages", () => {
    // Sending only the matched package produced "I only offer that one package
    // right now" to a client who had asked about two of them. That claim is
    // false, and it came out of the facts block.
    const facts = buildPricingFacts({
      sessionType: "Couples Session",
      message: "Hey we love your photography style. Either looking at standard or signature package",
    });
    const text = facts.lines.join(" ");
    expect(text).toContain("$350");
    expect(text).toContain("$450");
    expect(text).toContain("$575");
    expect(facts.basePrices).toEqual([350, 450, 575]);
  });

  it("keeps a proposal on one rate", () => {
    const facts = buildPricingFacts({
      sessionType: "Couples Session",
      message: "I'm going to propose to her, want someone to capture the surprise",
    });
    expect(facts.basePrices).toEqual([750]);
    expect(facts.lines.join(" ")).not.toContain("$350");
  });

  it("keeps an engagement session on one rate", () => {
    const facts = buildPricingFacts({
      sessionType: "Other",
      message: "My fiancée and I are looking to have some engagement photos taken",
    });
    expect(facts.basePrices).toEqual([650]);
    expect(facts.lines.join(" ")).not.toContain("$450");
  });
});
