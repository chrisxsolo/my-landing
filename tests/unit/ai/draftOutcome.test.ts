import { describe, it, expect } from "vitest";
import { buildDraftOutcome, similarityOf } from "@/lib/ai/draftOutcome";

// ─────────────────────────────────────────────────────────────────────────────
// The measurement that answers "does Chris send these, or rewrite them".
// It must never carry email content, and it must keep a wrong PRICE separate
// from a wrong TURN OF PHRASE: one means the context was wrong, the other
// means the writing was.
// ─────────────────────────────────────────────────────────────────────────────

const DRAFT = `Hi Sarah,

Perfect! October 16th at 5:45 pm works for me

I'll send over the invoice and contract once we settle the location`;

describe("similarityOf", () => {
  it("scores an untouched send as 1", () => {
    expect(similarityOf(DRAFT, DRAFT)).toBe(1);
  });

  it("scores a full rewrite low", () => {
    expect(similarityOf(DRAFT, "Hi Sarah,\n\nSounds good, see you then")).toBeLessThan(0.4);
  });

  it("denominates by the longer side, so padding cannot score as unchanged", () => {
    const padded = `${DRAFT}\n\n${"extra words that were not in the draft at all ".repeat(6)}`;
    expect(similarityOf(DRAFT, padded)).toBeLessThan(0.6);
  });

  it("treats an empty pair as identical rather than dividing by zero", () => {
    expect(similarityOf("", "")).toBe(1);
    expect(similarityOf(DRAFT, "")).toBe(0);
  });
});

describe("buildDraftOutcome", () => {
  it("records a send with no edits as unchanged", () => {
    const outcome = buildDraftOutcome({ inquiryId: 131, aiDraft: DRAFT, sentDraft: DRAFT });
    expect(outcome.sentUnchanged).toBe(true);
    expect(outcome.similarity).toBe(1);
    expect(outcome.factualEdits).toBe(0);
    expect(outcome.stylisticEdits).toBe(0);
  });

  it("ignores trailing whitespace rather than calling it an edit", () => {
    expect(buildDraftOutcome({ inquiryId: 1, aiDraft: DRAFT, sentDraft: `${DRAFT}\n\n` }).sentUnchanged).toBe(true);
  });

  it("counts a corrected time as factual, not stylistic", () => {
    const sent = DRAFT.replace("5:45 pm", "6:15 pm");
    const outcome = buildDraftOutcome({ inquiryId: 1, aiDraft: DRAFT, sentDraft: sent });
    expect(outcome.sentUnchanged).toBe(false);
    expect(outcome.factualEdits).toBeGreaterThan(0);
    expect(outcome.editKinds).toContain("time_changed");
  });

  it("carries no email content into the row", () => {
    const outcome = buildDraftOutcome({ inquiryId: 1, aiDraft: DRAFT, sentDraft: "Hi Sarah,\n\nSounds good" });
    const serialised = JSON.stringify(outcome);
    expect(serialised).not.toContain("Sarah");
    expect(serialised).not.toContain("invoice");
    expect(serialised).not.toContain("5:45");
  });

  it("keeps the word counts so over- and under-writing are both visible", () => {
    const outcome = buildDraftOutcome({ inquiryId: null, aiDraft: DRAFT, sentDraft: "Hi Sarah,\n\nSounds good" });
    expect(outcome.aiWords).toBeGreaterThan(outcome.sentWords);
    expect(outcome.inquiryId).toBeNull();
  });
});
