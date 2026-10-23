// ─────────────────────────────────────────────────────────────────────────────
// Elopement and courthouse ceremony coverage.
//
// This service sits between two rates it must never be confused with: the $750
// proposal session and the $450 one-hour couples session. The classifier is
// what keeps them apart, and the facts block is what stops the $950 floor being
// read as a total, since the base coverage duration has not been set.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { classifySession, resolvePlaybookKey } from "@/lib/ai/sessionClassifier";
import { buildPricingFacts } from "@/lib/ai/businessFacts";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { getPlaybook } from "@/lib/ai/soloxsnapsWritingProfile";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { buildSystemPrompt, buildGenerateUserPrompt } from "@/lib/ai/emailPrompt";
import { validateEmailDraft } from "@/lib/ai/validateEmailDraft";
import { AVAILABILITY, NOW, inquiry } from "./fixtures";

const ELOPEMENT_TYPE = "Elopement / Courthouse Ceremony";
const BASE = PRICING_CATALOG.elopement.startingPrice;
const EXTRA_LOCATION = PRICING_CATALOG.elopement.addOns.extraLocation.price;

describe("a ceremony is an elopement, whatever the form says", () => {
  it("reads a courthouse ceremony filed as its own type", () => {
    const message = "We're having a small courthouse ceremony and would love photos of the ceremony and a few portraits after";
    expect(resolvePlaybookKey(ELOPEMENT_TYPE, message)).toBe("elopement");
  });

  it("overrides a Couples Session the client picked by mistake", () => {
    // The message outranks the dropdown: both are request-grade, and elopement
    // is the more specific of the two.
    const message = "My partner and I are eloping at the courthouse and would love photos of our ceremony";
    const result = classifySession("Couples Session", message);
    expect(result.key).toBe("elopement");
    expect(result.ambiguous).toBe(false);
  });

  it.each([
    "We're getting married at City Hall in March, looking for ceremony coverage",
    "Looking for someone to photograph our intimate wedding, just us and the officiant",
    "We want a photographer for our wedding ceremony and portraits with our parents afterward",
    "planning a micro-wedding with 12 guests",
    "we're exchanging our vows at the courthouse next month",
  ])("recognises %s", (message) => {
    expect(resolvePlaybookKey("Couples Session", message)).toBe("elopement");
  });

  it("keeps a surprise proposal on the proposal rate", () => {
    const message = "I'm planning to propose to my girlfriend and want someone to capture the surprise";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("proposal");
    expect(buildPricingFacts({ sessionType: "Couples Session", message }).basePrices)
      .toEqual([PRICING_CATALOG.couples.packages.proposal.price]);
  });

  it("leaves a plain couples session on the couples card", () => {
    const message = "My wife and i would like a general couples session, romantic portraits somewhere in the city";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("couples");
    const facts = buildPricingFacts({ sessionType: "Couples Session", message });
    expect(facts.basePrices).toEqual([350, 450, 575]);
    expect(facts.basePrices).not.toContain(BASE);
  });

  it("does not turn a couple who missed their own wedding photos into an elopement", () => {
    // They are already married and asked for an hour. This is the shape that
    // used to be quoted at the $750 proposal rate.
    const message =
      "we recently got married Sept 4th but unfortunately we did not take pictures of our proposal or wedding so we'd love to book an hour session and make up for it";
    expect(resolvePlaybookKey("Couples Session", message)).toBe("couples");
  });
});

describe("the elopement facts quote a floor, never a total", () => {
  const facts = buildPricingFacts({ sessionType: ELOPEMENT_TYPE, message: "courthouse ceremony in April" });

  it("gives the starting price as the only base", () => {
    expect(facts.verified).toBe(true);
    expect(facts.basePrices).toEqual([BASE]);
    expect(facts.lines.join(" ")).toContain(`starts at $${BASE}`);
  });

  it("offers the second location and nothing else as an add-on", () => {
    expect(facts.addOnPrices).toEqual([EXTRA_LOCATION]);
    // $950 + $125. Travel is deliberately absent: it is calculated separately
    // and is never a flat figure.
    expect(BASE + EXTRA_LOCATION).toBe(1075);
  });

  it("carries the 2-hour base and the 60-image minimum from the catalog", () => {
    const hours = PRICING_CATALOG.elopement.durationMinutes / 60;
    const text = facts.lines.join(" ");
    expect(text).toContain(`${hours} hours`);
    expect(text).toContain(`minimum of ${PRICING_CATALOG.elopement.minimumImages} edited`);
    expect(text).toMatch(/Never offer unlimited coverage/);
    // No duration other than the catalog's may reach the model.
    const durations = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*hours?\b/g)].map((m) => Number(m[1]));
    expect(new Set(durations)).toEqual(new Set([hours]));
  });

  it("says the second location is a stop, not extra time", () => {
    expect(facts.lines.join(" ")).toMatch(/second stop INSIDE the 2 hours, not extra time/);
  });

  it("checks the hours before settling a total", () => {
    expect(facts.needsManualQuote).toMatch(/covers 2 hours and is verified/);
    expect(facts.needsManualQuote).toMatch(/check the hours before promising a total/);
  });

  it("never prices extra coverage or travel itself", () => {
    const text = facts.lines.join(" ");
    expect(text).toMatch(/custom quote/i);
    expect(text).toMatch(/no flat travel fee/);
  });

  it("does not leak the $750 proposal rate or a couples package price", () => {
    const text = facts.lines.join(" ");
    for (const price of [750, 450, 650, 575, 350]) {
      expect(text).not.toContain(`$${price}`);
    }
  });
});

describe("the elopement playbook", () => {
  const playbook = getPlaybook(ELOPEMENT_TYPE, "courthouse ceremony, two of us plus my parents");

  it("checks the base hours cover the plan rather than inventing a length", () => {
    expect(playbook).toMatch(/check the base hours cover what they have planned/);
    expect(playbook).toMatch(/never promise a final total/);
  });

  it("keeps the invoice and contract after the details are confirmed", () => {
    expect(playbook).toMatch(/invoice and contract follow once the details are confirmed/);
  });
});

// ── End to end: the prompt the model sees, and the draft it may send ─────────

describe("an elopement inquiry end to end", () => {
  const courthouse = (overrides: Partial<Parameters<typeof inquiry>[0]> = {}) =>
    buildEmailContext({
      inquiry: inquiry({
        name: "Maya Ortiz",
        sessionType: ELOPEMENT_TYPE,
        message: "We're having our courthouse ceremony and would love coverage, plus portraits with my parents after",
        school: null,
        location: "San Francisco City Hall",
        ...overrides,
      }),
      messages: [],
      availability: AVAILABILITY,
      threadLoaded: true,
      adminRow: null,
      latestClientMessage: null,
      now: NOW,
    });

  function promptText(context: ReturnType<typeof courthouse>): string {
    const system = buildSystemPrompt(context, []);
    return [
      system.stable,
      system.volatile,
      buildGenerateUserPrompt({ context, latestClientMessage: null, threadText: null }),
    ].join("\n");
  }

  it("sends the elopement rate and no other service's rate", () => {
    const text = promptText(courthouse());
    expect(text).toContain(`starts at $${BASE}`);
    expect(text).toContain(`$${BASE} for 2 hours of coverage`);
    expect(text).not.toContain("$750");
    expect(text).not.toContain("$450");
  });

  it("tells the model the total is not settled until the hours are", () => {
    expect(promptText(courthouse())).toMatch(/PRICE NOT VERIFIED: \$950 covers 2 hours and is verified/);
  });

  it("lets the draft quote the starting price and the second location", () => {
    const context = courthouse();
    const draft = [
      "Hi Maya,",
      "",
      `Thank you so much for reaching out, and congratulations! I'd love to photograph your ceremony`,
      "",
      `Coverage starts at $${BASE}, and adding a second nearby spot for portraits is $${EXTRA_LOCATION}`,
      "",
      "How long would you like covered? Once we settle that I'll send over the invoice and contract",
    ].join("\n");
    const issues = validateEmailDraft(draft, context).issues.map((i) => i.type);
    expect(issues).not.toContain("unsupported_price");
  });

  it("allows the real two-item total and flags an invented travel fee", () => {
    const context = courthouse();
    const ok = `Hi Maya,\n\nThat comes to $${BASE + EXTRA_LOCATION} for the ceremony and the second location`;
    expect(validateEmailDraft(ok, context).issues.map((i) => i.type)).not.toContain("unsupported_price");

    // $1,200 is the preliminary Santa Cruz arithmetic: $950 + $125 + a $125
    // travel guess. No travel figure is a fact here, so it must be flagged.
    const invented = `Hi Maya,\n\nWith travel that would be $1,200 all in`;
    expect(validateEmailDraft(invented, context).issues.map((i) => i.type)).toContain("unsupported_price");
  });

  it("warns on travel rather than pricing it when the ceremony is out of the city", () => {
    const context = courthouse({ location: "Santa Cruz County Courthouse", message: "courthouse ceremony in Santa Cruz" });
    expect(context.pricing.travelFact).toMatch(/NOT in the rate card/);
    expect(context.warnings.map((w) => w.code)).toContain("travel_unverified");
    const invented = `Hi Maya,\n\nTravel to Santa Cruz is $140, so $${BASE + 140} total`;
    expect(validateEmailDraft(invented, context).issues.map((i) => i.type)).toContain("unsupported_price");
    // A travel guess that happens to equal an add-on price is the one case the
    // validator cannot separate by arithmetic alone, which is why the facts
    // block also forbids stating a travel amount outright.
    expect(context.pricing.lines.join(" ")).toMatch(/no flat travel fee/);
  });
});

describe("a courthouse is also a graduation photo spot", () => {
  it("leaves grad photos at a courthouse on the graduation rate", () => {
    const message = "I'm graduating in May and would love grad photos on the courthouse steps downtown";
    expect(resolvePlaybookKey("Graduation Portrait", message)).toBe("graduation");
    expect(buildPricingFacts({ sessionType: "Graduation Portrait", message }).basePrices).toContain(350);
  });

  it("still reads a courthouse wedding as an elopement", () => {
    for (const message of [
      "We're having a small courthouse ceremony in March",
      "we're getting married at the courthouse, just the two of us",
      "Courthouse wedding, then portraits nearby",
    ]) {
      expect(resolvePlaybookKey("Couples Session", message)).toBe("elopement");
    }
  });
});
