// ─────────────────────────────────────────────────────────────────────────────
// How open dates and session lengths reach the prompt.
//
// Both regressions here came from reading live drafts against real inquiries:
// one draft recited twelve consecutive dates, and one burned its whole output
// budget on a pricing question the facts did not answer and came back cut off.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { buildVolatileSystem } from "@/lib/ai/emailPrompt";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { buildPricingFacts } from "@/lib/ai/businessFacts";
import { NOW, inquiry } from "./fixtures";
import type { AvailabilitySnapshot } from "@/lib/ai/buildEmailContext";

function snapshot(dates: string[], notes: Record<string, string> = {}): AvailabilitySnapshot {
  return {
    asOf: "2026-10-14",
    available: dates.map((date) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "short", month: "long", day: "numeric", year: "numeric",
      }),
      note: notes[date] ?? null,
    })),
    onHold: [],
    booked: [],
  };
}

/** Just the availability section: the examples below it quote past dates. */
function availabilityText(dates: string[], notes?: Record<string, string>): string {
  const full = buildVolatileSystem(
    buildEmailContext({
      inquiry: inquiry(),
      messages: [],
      availability: snapshot(dates, notes),
      threadLoaded: true,
      now: NOW,
    }),
  );
  return full.split("# Verified pricing")[0];
}

describe("consecutive open dates become a range", () => {
  it("compresses a long run instead of listing every day", () => {
    const text = availabilityText([
      "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19",
      "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23",
      "2026-10-25", "2026-10-26", "2026-10-27",
    ]);
    expect(text).toContain("October 15th to 23rd");
    expect(text).toContain("October 25th to 27th");
    // The recital that triggered this: every day spelled out.
    expect(text).not.toContain("October 16th");
    expect(text).not.toContain("October 19th");
  });

  it("keeps a pair of dates as two dates", () => {
    const text = availabilityText(["2026-10-26", "2026-10-27"]);
    expect(text).toContain("October 26th");
    expect(text).toContain("October 27th");
    expect(text).not.toContain("to 27th");
  });

  it("never merges a date that carries a note", () => {
    const text = availabilityText(
      ["2026-10-15", "2026-10-16", "2026-10-17"],
      { "2026-10-16": "morning only" },
    );
    expect(text).toContain("morning only");
    expect(text).not.toContain("October 15th to 17th");
  });

  it("spans a month boundary", () => {
    const text = availabilityText([
      "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02",
    ]);
    expect(text).toContain("October 30th to November 2nd");
  });

  it("tells the model to offer a few, not the whole list", () => {
    const many = availabilityText([
      "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19",
    ]);
    expect(many).toMatch(/three or four/);

    const few = availabilityText(["2026-10-26", "2026-10-28"]);
    expect(few).not.toMatch(/three or four/);
  });
});

describe("a longer group graduation session is priced, not guessed", () => {
  it("answers 'rate for 2 people for 1.5 hours' from the card", () => {
    // This inquiry truncated a draft: the facts covered the group rate and the
    // extra-30 add-on but never said how they combine.
    const facts = buildPricingFacts({
      sessionType: "Graduation Portrait",
      message: "hi wanted to know your rate and availability for 2 people for 1.5hours! thank you",
      people: "2",
    });
    const text = facts.lines.join(" ");
    expect(text).toContain("$600");
    expect(text).toContain("$700");
  });

  it("says the 90-minute minimum is included for a group of three or more", () => {
    const facts = buildPricingFacts({
      sessionType: "Graduation Portrait",
      message: "three of us graduating",
      people: "3",
    });
    expect(facts.lines.join(" ")).toMatch(/included in the per-person rate/);
  });

  it("states the lengths offered for a solo session", () => {
    const facts = buildPricingFacts({
      sessionType: "Graduation Portrait",
      message: "grad photos, maybe two hours?",
      people: "1",
    });
    expect(facts.lines.join(" ")).toMatch(/60, 90, 120 minutes/);
  });
});
