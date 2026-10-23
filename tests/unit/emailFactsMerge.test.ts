import { describe, expect, it } from "vitest";
import {
  isDefaultAccepted, planFactMerge, toFormValue,
} from "@/lib/contentEngine/emailFacts/merge";
import type { ExtractedFact } from "@/lib/contentEngine/emailFacts/extract";
import type { EmailFactField } from "@/lib/contentEngine/emailFacts/fields";

const fact = (
  field: EmailFactField, value: string | string[], over: Partial<ExtractedFact> = {},
): ExtractedFact => ({
  field, value, confidence: "high", status: "confirmed",
  evidence: "Palace of Fine Arts works perfectly!",
  sourceMessageId: "m3", sourceAt: "2026-10-08T17:00:00.000Z",
  ...over,
});

const find = (suggestions: ReturnType<typeof planFactMerge>, field: EmailFactField) =>
  suggestions.find((s) => s.field === field);

describe("Scenario A / merge rule 1 — an empty field is offered a value", () => {
  it("marks an empty field as a fill and pre-ticks it", () => {
    const [suggestion] = planFactMerge([fact("primary_location", "Palace of Fine Arts")], {});
    expect(suggestion.action).toBe("fill");
    expect(suggestion.currentValue).toBe("");
    expect(suggestion.proposedValue).toBe("Palace of Fine Arts");
    expect(isDefaultAccepted(suggestion)).toBe(true);
  });
});

describe("merge rule 2 — a matching value is left alone", () => {
  it("reports unchanged, ignoring case and spacing", () => {
    const suggestions = planFactMerge(
      [fact("primary_location", "Palace of Fine Arts")],
      { primary_location: "palace of  fine arts" },
    );
    expect(suggestions[0].action).toBe("unchanged");
    expect(isDefaultAccepted(suggestions[0])).toBe(false);
  });

  it("compares a location list as a set, not as a string", () => {
    const suggestions = planFactMerge(
      [fact("secondary_locations", ["Lovers Lane", "Baker Beach"])],
      { secondary_locations: "Baker Beach, Lovers Lane" },
    );
    expect(suggestions[0].action).toBe("unchanged");
  });
});

describe("Scenario E / merge rule 3 — a disagreement is flagged, never applied", () => {
  it("reports a conflict with both values and the evidence behind the new one", () => {
    const [suggestion] = planFactMerge(
      [fact("primary_location", "Baker Beach", {
        evidence: "let's switch to Baker Beach", sourceAt: "2026-10-15T17:00:00.000Z",
      })],
      { primary_location: "Palace of Fine Arts" },
    );
    expect(suggestion.action).toBe("conflict");
    expect(suggestion.currentValue).toBe("Palace of Fine Arts");
    expect(suggestion.proposedValue).toBe("Baker Beach");
    expect(suggestion.evidence).toBe("let's switch to Baker Beach");
    expect(suggestion.sourceAt).toBe("2026-10-15T17:00:00.000Z");
  });

  it("never pre-ticks a conflict — overwriting is always an explicit choice", () => {
    const [suggestion] = planFactMerge(
      [fact("session_date", "2026-10-27")],
      { session_date: "2026-10-25" },
    );
    expect(isDefaultAccepted(suggestion)).toBe(false);
  });
});

describe("Scenario C — an unconfirmed change does not reach the form", () => {
  it("produces nothing for a field the extraction could not support", () => {
    // The client asked whether the 27th was free; nothing was confirmed, so
    // the extractor returned no session_date at all.
    const suggestions = planFactMerge(
      [fact("primary_location", "Palace of Fine Arts")],
      { session_date: "2026-10-25", primary_location: "Palace of Fine Arts" },
    );
    expect(find(suggestions, "session_date")).toBeUndefined();
  });

  it("surfaces a merely proposed change as a conflict for a human to judge", () => {
    const [suggestion] = planFactMerge(
      [fact("session_date", "2026-10-27", { status: "proposed", confidence: "low" })],
      { session_date: "2026-10-25" },
    );
    expect(suggestion.action).toBe("conflict");
    expect(suggestion.status).toBe("proposed");
    expect(isDefaultAccepted(suggestion)).toBe(false);
  });
});

describe("merge rules 4 and 5 — existing values are never lost", () => {
  it("offers nothing for fields the conversation said nothing about", () => {
    expect(planFactMerge([], { primary_location: "Palace of Fine Arts" })).toEqual([]);
  });

  it("refuses to offer an empty value over a known one", () => {
    expect(planFactMerge([fact("primary_location", "   ")], { primary_location: "Baker Beach" }))
      .toEqual([]);
    expect(planFactMerge([fact("secondary_locations", [])], {})).toEqual([]);
  });
});

describe("presentation", () => {
  it("puts fills first, then conflicts, then what already matches", () => {
    const suggestions = planFactMerge(
      [
        fact("primary_location", "Baker Beach"),
        fact("service_type", "couples"),
        fact("session_date", "2026-10-25"),
      ],
      { primary_location: "Palace of Fine Arts", session_date: "2026-10-25" },
    );
    expect(suggestions.map((s) => s.action)).toEqual(["fill", "conflict", "unchanged"]);
  });

  it("renders a list as the comma-separated form the facts form uses", () => {
    expect(toFormValue(["Lovers Lane", "Baker Beach"])).toBe("Lovers Lane, Baker Beach");
    const [suggestion] = planFactMerge([fact("secondary_locations", ["Lovers Lane", "Baker Beach"])], {});
    expect(suggestion.proposedValue).toBe("Lovers Lane, Baker Beach");
  });

  it("marks the private fields so the panel can label them", () => {
    const suggestions = planFactMerge(
      [fact("internal_notes", "Wheelchair access needed at the meeting point."), fact("primary_location", "Baker Beach")],
      {},
    );
    expect(find(suggestions, "internal_notes")?.internal).toBe(true);
    expect(find(suggestions, "primary_location")?.internal).toBe(false);
  });

  it("carries the field's human label through", () => {
    const [suggestion] = planFactMerge([fact("start_time", "17:30")], {});
    expect(suggestion.label).toBe("Session time");
  });
});

describe("Scenario G — a second look reflects the newest message", () => {
  it("re-planning against the same form yields the newer value as a conflict", () => {
    // First extraction filled the Palace; the client has since confirmed a
    // different location, so the second run must flag it rather than hide it.
    const firstRun = planFactMerge([fact("primary_location", "Palace of Fine Arts")], {});
    expect(firstRun[0].action).toBe("fill");

    const afterSaving = { primary_location: firstRun[0].proposedValue };
    const secondRun = planFactMerge(
      [fact("primary_location", "Baker Beach", { sourceAt: "2026-10-20T17:00:00.000Z" })],
      afterSaving,
    );
    expect(secondRun[0].action).toBe("conflict");
    expect(secondRun[0].proposedValue).toBe("Baker Beach");
  });
});
