// ─────────────────────────────────────────────────────────────────────────────
// Multi-turn behaviour, checked without an API call.
//
// Two things are testable deterministically here. First, that a draft built
// for turn N cannot see turn N+1: a reply that "knows" the location the client
// confirms three emails later would score beautifully and mean nothing.
// Second, that the thread digest actually carries the settled facts forward,
// which is what lets the prompt tell the model not to restate them.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { CONVERSATION_CASES } from "../../live/conversationCases";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { buildSystemPrompt, buildGenerateUserPrompt } from "@/lib/ai/emailPrompt";

function contextFor(index: number) {
  const testCase = CONVERSATION_CASES[index];
  return {
    testCase,
    context: buildEmailContext({
      inquiry: testCase.inquiry,
      messages: testCase.history,
      availability: testCase.availability,
      threadLoaded: true,
      now: new Date(testCase.history.at(-1)!.timestamp as string),
    }),
  };
}

/** Everything the model is shown for this turn, as one string. */
function fullPrompt(index: number): string {
  const { testCase, context } = contextFor(index);
  const system = buildSystemPrompt(context, []);
  const user = buildGenerateUserPrompt({
    context,
    latestClientMessage: testCase.latestClientMessage,
    threadText: testCase.history.map((m) => `${m.fromMe ? "Chris" : "Client"}: ${m.body}`).join("\n\n"),
  });
  return `${system.stable}\n${system.volatile}\n${user}`;
}

describe("no future information reaches an earlier turn", () => {
  it("turn 2 of the family thread cannot know the October 9th booking", () => {
    const prompt = fullPrompt(0);
    // Settled four messages later. Also the meeting point, and the Fleet Week
    // exchange that happens three weeks on.
    for (const future of ["October 9", "picnic tables", "Fleet Week"]) {
      expect(prompt).not.toContain(future);
    }
  });

  it("the graduation thread cannot know the $30 Filoli fee Chris later set", () => {
    const prompt = fullPrompt(3);
    // He decided $30 by hand in the reply this case is asking the model to
    // write. The draft must not have it.
    // Word-boundary matched: "$300 per person" is a price he already quoted
    // in this thread and legitimately appears.
    expect(prompt).not.toMatch(/\$30\b/);
    // Nor the July dates negotiated several emails later.
    expect(prompt).not.toContain("July");
  });

  it("every case sees only its own history", () => {
    CONVERSATION_CASES.forEach((testCase, index) => {
      const { context } = contextFor(index);
      expect(context.thread.digest.messageCount).toBe(testCase.history.length);
    });
  });
});

describe("settled facts are carried forward so the draft can skip them", () => {
  it("knows the invoice went out once Chris says he sent it", () => {
    const { context } = contextFor(2); // after "I just sent over the invoice"
    expect(context.thread.digest.invoice).toBe("sent");
    expect(context.thread.lines.join(" ")).toMatch(/invoice has been sent/i);
  });

  it("knows an invoice was only promised, earlier in the same thread", () => {
    const { context } = contextFor(1); // "I can send over the invoice" only
    expect(context.thread.digest.invoice).toBe("promised");
    expect(context.thread.lines.join(" ")).toMatch(/no evidence it was actually sent/i);
  });

  it("carries the price Chris already quoted into the graduation turn", () => {
    const { context } = contextFor(3);
    // $300 per person and the $75 Santa Clara fee were both named.
    expect(context.thread.digest.quotedPrices).toContain("$300");
    expect(context.thread.digest.quotedPrices).toContain("$75");
  });

  it("does not treat a booking as paid without evidence", () => {
    for (let index = 0; index < CONVERSATION_CASES.length; index += 1) {
      expect(contextFor(index).context.thread.digest.depositPaid).toBe(false);
    }
  });
});

describe("the location change re-opens the travel fee", () => {
  it("stops quoting the Santa Clara fee once the shoot moves to Filoli", () => {
    const { context } = contextFor(3);
    // The campus fee no longer applies, and the new one is not in the card.
    expect(context.pricing.travelFact).toMatch(/NOT in the rate card/);
    expect(context.pricing.travelFact).not.toContain("$70");
    expect(context.warnings.map((w) => w.code)).toContain("travel_unverified");
  });
});
