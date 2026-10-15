import { describe, it, expect } from "vitest";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { buildSystemPrompt } from "@/lib/ai/emailPrompt";
import { buildSimpleSystemPrompt, STYLE_CONSOLIDATED } from "@/lib/ai/emailPromptSimple";
import { BANNED_PHRASES } from "@/lib/ai/soloxsnapsWritingProfile";

// ─────────────────────────────────────────────────────────────────────────────
// lib/ai/emailPromptSimple.ts is the simplified drafting prompt. It is NOT
// wired to production: the A/B run that would justify switching to it was cut
// short when the Anthropic account ran out of credit, so only a 12-case pilot
// exists and that is not enough to retire the current prompt.
//
// What this file protects is the property that makes the comparison worth
// running at all: both prompts must state exactly the same verified facts, so
// any measured difference is attributable to prompt strategy and not to one
// variant having been handed a price the other did not get.
// ─────────────────────────────────────────────────────────────────────────────

const AVAILABILITY = {
  asOf: "2026-10-15",
  available: [
    { date: "2026-10-20", label: "October 20th", note: null },
    { date: "2026-10-21", label: "October 21st", note: null },
  ],
  onHold: [],
  booked: [{ date: "2026-10-18", label: "October 18th", note: "booked" }],
};

const contextFor = (overrides: Record<string, unknown> = {}) =>
  buildEmailContext({
    inquiry: {
      name: "Danel Ortiz",
      email: "danel@example.com",
      sessionType: "Graduation Portrait",
      message: "I'm graduating from San Jose State and would love grad photos. What are your rates?",
      dateInMind: "2026-10-20",
      preferredTime: "sunset",
      location: null,
      school: "San Jose State University",
      people: 1,
    },
    messages: [],
    availability: AVAILABILITY,
    threadLoaded: true,
    now: new Date("2026-10-15T12:00:00Z"),
    ...overrides,
  });

/**
 * The sections that carry verified business facts.
 *
 * Only these are compared. Style guidance and the approved examples also
 * contain dollar figures and dates, but those are historical details from past
 * jobs that both prompts label as non-facts — comparing them would measure how
 * many worked examples each variant ships, which is exactly the thing the A/B
 * is supposed to be free to vary.
 */
const FACT_SECTIONS = [
  "Verified booking status",
  "Verified availability",
  "Verified pricing",
  "Timing",
];

function factSectionsOf(volatile: string): string {
  return volatile
    .split(/\n(?=# )/)
    .filter((section) => FACT_SECTIONS.some((name) => section.startsWith(`# ${name}`)))
    .join("\n");
}

/** Every dollar figure and calendar date a prompt states as fact. */
const factsIn = (text: string) => ({
  prices: [...text.matchAll(/\$\s?[\d,]+/g)].map((m) => m[0].replace(/\s/g, "")).sort(),
  dates: [...text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?/gi)]
    .map((m) => m[0].toLowerCase()).sort(),
});

describe("both prompts state the same verified facts", () => {
  it("quotes identical prices and dates in the fact sections", () => {
    const context = contextFor();
    const a = factsIn(factSectionsOf(buildSystemPrompt(context, []).volatile));
    const b = factsIn(factSectionsOf(buildSimpleSystemPrompt(context, [], true).volatile));

    expect(a.prices.length).toBeGreaterThan(0);
    expect(b.prices).toEqual(a.prices);
    expect(b.dates).toEqual(a.dates);
  });

  it("renders the fact sections byte-identically", () => {
    // Stronger than comparing extracted numbers: the two prompts import the
    // same renderers, so any drift here means one of them grew its own copy.
    const context = contextFor({ adminRow: { deposit_paid_at: "2026-10-01T00:00:00Z", booking_confirmed: true } });
    expect(factSectionsOf(buildSimpleSystemPrompt(context, [], true).volatile))
      .toBe(factSectionsOf(buildSystemPrompt(context, []).volatile));
  });

  it("carries the same booking-status lines", () => {
    const context = contextFor({ adminRow: { invoice_sent_at: "2026-10-01T00:00:00Z" } });
    const simple = buildSimpleSystemPrompt(context, [], true).volatile;
    for (const line of context.admin.lines) expect(simple).toContain(line);
  });

  it("keeps the injection guard and the output contract", () => {
    const stable = buildSimpleSystemPrompt(contextFor(), [], true).stable;
    expect(stable).toMatch(/quoted text written by the client/i);
    expect(stable).toMatch(/Output the email body as plain text/i);
  });
});

describe("what the simplified prompt deliberately drops", () => {
  it("states no per-stage omit list and no word budget", () => {
    const volatile = buildSimpleSystemPrompt(contextFor(), [], true).volatile;
    expect(volatile).not.toMatch(/Leave out:/);
    expect(volatile).not.toMatch(/\d+ to \d+ words/);
  });

  it("leaves the banned-phrase list to the validator instead of paying for it", () => {
    // Every entry is caught deterministically after generation, so listing all
    // of them in the prompt buys prevention that is already free.
    const stable = buildSimpleSystemPrompt(contextFor(), [], true).stable;
    for (const phrase of BANNED_PHRASES) expect(stable.toLowerCase()).not.toContain(phrase);
  });

  it("drops the session playbook on a follow-up whose price is already verified", () => {
    const followUp = contextFor({
      messages: [
        { timestamp: "2026-10-12T10:00:00Z", fromMe: true, body: "I'm available October 20th or 21st" },
        { timestamp: "2026-10-13T10:00:00Z", fromMe: false, body: "October 20th works for me!" },
      ],
      latestClientMessage: "October 20th works for me!",
    });
    expect(followUp.pricing.verified).toBe(true);
    expect(buildSimpleSystemPrompt(followUp, [], true).stable).not.toMatch(/# Shape of a .* reply/);
  });

  it("keeps the playbook on a first reply, where it is what sets the shape", () => {
    expect(buildSimpleSystemPrompt(contextFor(), [], true).stable).toMatch(/# Shape of a graduation reply/);
  });
});

describe("the simplified prompt is honest about missing history", () => {
  it("says the history could not be read, rather than implying there is none", () => {
    const volatile = buildSimpleSystemPrompt(contextFor(), [], false).volatile;
    expect(volatile).toMatch(/could not be loaded/i);
    expect(volatile).toMatch(/do not refer to an earlier message/i);
  });

  it("distinguishes that from a genuinely new client", () => {
    const volatile = buildSimpleSystemPrompt(contextFor(), [], true).volatile;
    expect(volatile).toMatch(/no email history with this client/i);
    expect(volatile).not.toMatch(/could not be loaded/i);
  });

  it("hands length back to the client's question instead of a target", () => {
    expect(STYLE_CONSOLIDATED.join(" ")).toMatch(/Length follows from that/);
  });
});
