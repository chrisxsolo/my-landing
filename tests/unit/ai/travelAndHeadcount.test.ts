// ─────────────────────────────────────────────────────────────────────────────
// Travel fees and headcount, from the 57-inquiry evaluation.
//
// Travel used to be keyed on `school` alone, so it only ever existed for
// graduations. Eight of the twenty-eight out-of-city inquiries in the sample
// produced no travel fact at all, which left the draft quoting the bare
// session price for a Point Reyes elopement and a Muir Woods proposal.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { buildTravelFact, buildPricingFacts } from "@/lib/ai/businessFacts";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { AVAILABILITY, NOW, inquiry } from "./fixtures";

const NOT_IN_CARD = /NOT in the rate card/;

describe("travel reaches sessions that are not graduations", () => {
  it.each([
    ["Shark Fin Cove Davenport, CA 95017"],
    ["Point Reyes Near Lighthouse"],
    ["Muir Woods"],
    ["Spina Farms Pumpkin Patch"],
    ["Rockaway Beach Pacifica"],
    ["East Bay"],
  ])("raises travel for %s even with no school", (location) => {
    const fact = buildTravelFact(null, location);
    expect(fact).toMatch(NOT_IN_CARD);
    // Never a number it had to guess at.
    expect(fact).not.toMatch(/\$\d/);
  });

  it("finds a location named only in the message", () => {
    // "if you could take photos anytime Friday ... at Rockaway Beach in
    // Pacifica" with both the location and school fields empty.
    const fact = buildTravelFact(null, null, "We were thinking at Rockaway Beach in Pacifica");
    expect(fact).toMatch(NOT_IN_CARD);
  });

  it("says nothing when it knows nothing", () => {
    expect(buildTravelFact(null, null, "looking for grad photos")).toBeNull();
  });
});

describe("the location outranks the school", () => {
  it("drops the campus fee when the shoot moves off campus", () => {
    // Chris re-quoted this himself: "since the location would be changing from
    // Santa Clara University to Filoli, the travel fee would be updated".
    const fact = buildTravelFact("Santa Clara University", "Filoli Garden");
    expect(fact).toMatch(NOT_IN_CARD);
    expect(fact).not.toContain("$65");
  });

  it("keeps the campus fee when the shoot is on campus", () => {
    expect(buildTravelFact("San Jose State University", null)).toContain("Travel fee for San Jose State University: $75.");
    expect(buildTravelFact(null, "San Jose State University")).toContain("Travel fee for San Jose State University: $75.");
    expect(buildTravelFact("University of California, Berkeley", null)).toContain("Travel fee for University of California, Berkeley: $45.");
    expect(buildTravelFact("University of California, Berkeley", null)).not.toContain("$43.50");
  });

  it("charges nothing inside San Francisco", () => {
    expect(buildTravelFact("San Francisco State University", null)).toMatch(/No travel fee/);
    expect(buildTravelFact(null, "Palace of Fine Arts")).toMatch(/No travel fee/);
  });

  it("does not spread a campus fee across the whole region", () => {
    // CSU East Bay's $65 is that campus, not everywhere in the East Bay.
    expect(buildTravelFact(null, "East Bay")).not.toContain("$65");
    expect(buildTravelFact("California State University, East Bay", null)).toContain("$65.");
    // "Cal State" is not Cal: this school field used to get Berkeley's fee.
    expect(buildTravelFact("Cal State East Bay", null)).toContain("$65.");
  });
});

describe("an unverified travel fee is surfaced to the admin", () => {
  it("warns when the session price is known but the travel fee is not", () => {
    const context = buildEmailContext({
      inquiry: inquiry({
        sessionType: "Family Session",
        message: "family photos while everyone is together",
        location: "Rockaway Beach Pacifica",
      }),
      messages: [],
      availability: AVAILABILITY,
      threadLoaded: true,
      now: NOW,
    });
    expect(context.warnings.map((w) => w.code)).toContain("travel_unverified");
  });

  it("stays quiet for a session in the city", () => {
    const context = buildEmailContext({
      inquiry: inquiry({
        sessionType: "Family Session",
        message: "family photos",
        location: "Crissy Field",
      }),
      messages: [],
      availability: AVAILABILITY,
      threadLoaded: true,
      now: NOW,
    });
    expect(context.warnings.map((w) => w.code)).not.toContain("travel_unverified");
  });
});

describe("headcount is summed, not taken from the first number", () => {
  it("counts a family listed in groups", () => {
    // "8 adults, 3 children ages 10-5 and 1 four month old baby" read as 8,
    // which kept a party of twelve on the standard family session.
    const facts = buildPricingFacts({
      sessionType: "Family Session",
      message: "We have 8 adults, 3 children ages 10-5 and 1 four month old baby",
      people: null,
    });
    expect(facts.needsManualQuote).toMatch(/larger group/i);
  });

  it("does not quote a headcount back at the client", () => {
    const facts = buildPricingFacts({
      sessionType: "Family Session",
      message: "We have 8 adults, 3 children and 1 baby",
      people: null,
    });
    // The sum is good enough to know the group is large, not good enough to
    // state as a fact.
    expect(facts.needsManualQuote).not.toMatch(/\d+ people/);
  });

  it("reads a worded family size", () => {
    const facts = buildPricingFacts({
      sessionType: "Family Session",
      message: "a location that would be suitable for a family of six",
      people: null,
    });
    expect(facts.needsManualQuote).toBeNull();
  });

  it("treats the form's '5+' as a floor, not a ceiling", () => {
    const facts = buildPricingFacts({
      sessionType: "Family Session",
      message: "9 adults and 2 kids coming",
      people: "5+",
    });
    expect(facts.needsManualQuote).toMatch(/larger group/i);
  });

  it("leaves a normal family session alone", () => {
    const facts = buildPricingFacts({
      sessionType: "Family Session",
      message: "We're a family of 3 and a dog. We're hoping for a natural vibe",
      people: "3",
    });
    expect(facts.needsManualQuote).toBeNull();
    expect(facts.basePrices).toEqual([350, 500]);
  });
});
