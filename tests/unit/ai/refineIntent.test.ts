// ─────────────────────────────────────────────────────────────────────────────
// Refine AI draft reads feedback as intent, not as text to paste.
//
// Chris's note "this makes it sound like they're already booked" is a request
// to remove the premature commitment, not a sentence for the client. These
// cases pin the prompt the model receives, the one-call rule, the exact-wording
// exception, and the validator's refusal to let an invented fact through.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { refineDraft, feedbackRequestsExactWording } from "@/lib/ai/emailOperations";
import { buildEmailContext } from "@/lib/ai/buildEmailContext";
import { validateEmailDraft } from "@/lib/ai/validateEmailDraft";
import { AVAILABILITY, NOW, inquiry, fakeCaller } from "./fixtures";

const DRAFT = `Hi Sarah,

Perfect, October 26th at golden hour works for me!

My graduation sessions are $350 for the hour, which gets you a great set of edited photos that really capture the moment.

I'll send over the invoice and contract to lock in your session, and I'm so excited to shoot this with you!`;

const base = () => ({
  inquiry: inquiry({ sessionType: "Graduation", school: "UC Berkeley" }),
  messages: [], availability: AVAILABILITY, threadLoaded: true, rules: [], now: NOW,
  currentDraft: DRAFT,
});

async function refine(feedback: string, reply = DRAFT.replace("I'll send over the invoice and contract to lock in your session", "Once we confirm the details I'll send the invoice over")) {
  const call = fakeCaller(reply);
  const result = await refineDraft({ ...base(), feedback }, call);
  return { call, result, prompt: call.calls[0].userPrompt };
}

describe("1. meta-feedback about a premature commitment", () => {
  const FEEDBACK = "This sounds like they're already booked. I only want to say I'll send the invoice after we confirm the details.";

  it("frames the feedback as a description of the result, never as text to insert", async () => {
    const { prompt, call } = await refine(FEEDBACK);
    expect(call.calls).toHaveLength(1);
    expect(prompt).toContain(FEEDBACK);
    expect(prompt).toMatch(/feedback about the draft, not text for the email/i);
    expect(prompt).toMatch(/never copy his feedback/i);
    expect(prompt).toMatch(/smallest coherent region|only the part .* feedback is about/i);
    expect(prompt).toMatch(/leave every other sentence exactly as it is/i);
    expect(prompt).not.toMatch(/apply that instruction and change nothing else/i);
  });

  it("does not switch on the exact-wording mode for conversational feedback", () => {
    expect(feedbackRequestsExactWording(FEEDBACK)).toBe(false);
    expect(feedbackRequestsExactWording("Make the price sentence less awkward and less salesy.")).toBe(false);
  });
});

describe("2. tone feedback on one sentence", () => {
  it("tells the model to resolve the reference against the draft and keep the facts", async () => {
    const { prompt } = await refine("Make the price sentence less awkward and less salesy.");
    expect(prompt).toMatch(/"the price sentence"|the sentence .*the feedback points at/i);
    expect(prompt).toMatch(/every date, time, price, location, person, question, next step, and booking or payment claim stays/i);
  });
});

describe("3. a requested fact that is not verified", () => {
  it("tells the model to leave an unverified addition out rather than guess", async () => {
    const { prompt } = await refine("Mention turnaround time");
    expect(prompt).toMatch(/not in the verified facts .*leave it out/i);
    expect(prompt).toMatch(/do not guess|rather than guess/i);
  });

  it("flags an invented delivery window the verified facts do not support", async () => {
    const context = buildEmailContext(base());
    const invented = `${DRAFT}\n\nYou'll have your edited gallery back within 3 days!`;
    const issues = validateEmailDraft(invented, context).issues;
    expect(issues.map((i) => i.type)).toContain("unsupported_turnaround");
    expect(issues.find((i) => i.type === "unsupported_turnaround")?.category).toBe("factual");
  });

  it("accepts the catalog's own turnaround and ignores session durations", async () => {
    const context = buildEmailContext(base());
    const fine = `${DRAFT}\n\nYour edited gallery is delivered within 14 days, and the session itself is 1 hour`;
    expect(validateEmailDraft(fine, context).issues.map((i) => i.type)).not.toContain("unsupported_turnaround");
  });
});

describe("4. explicit exact wording is honoured", () => {
  const FEEDBACK = "Replace the closing with exactly: Looking forward to hearing back from you!";

  it("detects the request for exact wording", () => {
    expect(feedbackRequestsExactWording(FEEDBACK)).toBe(true);
    expect(feedbackRequestsExactWording('Change the ending to "Talk soon!"')).toBe(true);
    expect(feedbackRequestsExactWording("Use these exact words for the opener: Hi there")).toBe(true);
  });

  it("tells the model to use the given words verbatim", async () => {
    const { prompt } = await refine(FEEDBACK, DRAFT.replace(/I'll send over[^\n]*$/, "Looking forward to hearing back from you!"));
    expect(prompt).toMatch(/exact wording.*use (it|those words) verbatim|verbatim/i);
  });
});

describe("5. a narrow verified factual change", () => {
  it("keeps the rest of the draft stable and makes one call", async () => {
    const reply = DRAFT.replace("October 26th", "October 28th");
    const { call, result } = await refine("Change the date to October 28th", reply);
    expect(call.calls).toHaveLength(1);
    expect(result.draft).toContain("October 28th");
    expect(result.draft).toContain("$350");
    expect(result.validation.issues.map((i) => i.type)).not.toContain("unsupported_date");
    expect(result.unchanged).toBe(false);
  });
});

describe("no change produced", () => {
  it("reports an unchanged result instead of pretending the refinement applied", async () => {
    const { call, result } = await refine("Make the ending warmer", DRAFT);
    expect(call.calls).toHaveLength(1);
    expect(result.unchanged).toBe(true);
  });

  it("ignores whitespace and the period stripping when deciding", async () => {
    const { result } = await refine("Make the ending warmer", `${DRAFT.replace(/\n\n/g, "\n\n\n")}\n`);
    expect(result.unchanged).toBe(true);
  });
});
