// ─────────────────────────────────────────────────────────────────────────────
// Which AI draft "Learn from reply" compares against, and how the panel reads
// the route's structured outcome. Pure helpers, no React.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  selectLearnBaseline, interpretLearnResponse, SEND_CLEARED_DRAFT_KINDS,
} from "@/app/admin/conversation/[id]/learnBaseline";

const FIRST = "Hi Sam,\n\nFirst generated draft";
const REFINED = "Hi Sam,\n\nRefined draft Chris actually edited";

describe("selectLearnBaseline", () => {
  it("compares against the latest AI output, never the first draft", () => {
    const baseline = selectLearnBaseline({ lastAiDraft: REFINED, originalAiDraft: FIRST, sentCycleAiDraft: "", manualAiDraft: "" });
    expect(baseline).toEqual({ text: REFINED, source: "latest_ai" });
  });

  it("after a send, uses the snapshot of the AI draft from the cycle just sent", () => {
    const baseline = selectLearnBaseline({ lastAiDraft: "", originalAiDraft: "", sentCycleAiDraft: REFINED, manualAiDraft: "" });
    expect(baseline).toEqual({ text: REFINED, source: "sent_cycle" });
  });

  it("never falls back to a stale first draft from an earlier cycle", () => {
    // Earlier cycle's original leaked into storage; the current cycle has no AI draft.
    const baseline = selectLearnBaseline({ lastAiDraft: "", originalAiDraft: FIRST, sentCycleAiDraft: "", manualAiDraft: "" });
    expect(baseline).toEqual({ text: "", source: "none" });
  });

  it("uses the pasted draft only when there is no AI baseline", () => {
    expect(selectLearnBaseline({ lastAiDraft: "", originalAiDraft: "", sentCycleAiDraft: "", manualAiDraft: "  pasted  " }))
      .toEqual({ text: "pasted", source: "manual" });
    expect(selectLearnBaseline({ lastAiDraft: REFINED, originalAiDraft: "", sentCycleAiDraft: "", manualAiDraft: "pasted" }).source)
      .toBe("latest_ai");
  });

  it("clears every persisted draft kind when a send completes", () => {
    expect([...SEND_CLEARED_DRAFT_KINDS].sort()).toEqual(["ai_draft", "draft", "original_ai_draft"]);
  });
});

describe("interpretLearnResponse", () => {
  const factual = { kind: "price_changed", category: "factual", description: "The price changed from $450 to $475." };
  const style = { kind: "phrase_added", category: "style", description: "A sentence was added." };

  it("shows pending rules and clears the sent text on full success", () => {
    const view = interpretLearnResponse(true, {
      outcome: "rules_pending", edits: [factual, style],
      candidates: [{ rule: "Keep it short", intake: { verdict: "new" } }],
      pending: [{ id: "1", rule: "Keep it short" }], message: "1 new rule to approve",
    });
    expect(view.kind).toBe("rules_pending");
    expect(view.rules).toEqual(["Keep it short"]);
    expect(view.factualEdits).toEqual([factual.description]);
    expect(view.clearSentText).toBe(true);
    expect(view.toastOk).toBe(true);
  });

  it("keeps the pasted email for a retry when phrasing failed", () => {
    const view = interpretLearnResponse(true, {
      outcome: "phrasing_failed", edits: [factual, style], candidates: [], pending: [],
      message: "I found 2 changes, but couldn't turn the style changes into rules. Your edits are still here; try again.",
      error_code: "overloaded", retryable: true,
    });
    expect(view.kind).toBe("retry");
    expect(view.clearSentText).toBe(false);
    expect(view.factualEdits).toEqual([factual.description]);
    expect(view.toastOk).toBe(false);
    expect(view.toast).toMatch(/found 2 changes/);
    expect(view.toast).not.toMatch(/draft request failed/i);
  });

  it("does not list rules as pending when persistence failed", () => {
    const view = interpretLearnResponse(true, {
      outcome: "persist_failed", edits: [style],
      candidates: [{ rule: "Keep it short", intake: { verdict: "new" } }],
      pending: [], message: "couldn't save", error_code: "rules_write", retryable: true,
    });
    expect(view.kind).toBe("retry");
    expect(view.rules).toEqual([]);
    expect(view.clearSentText).toBe(false);
  });

  it("reports an identical send without a retry prompt", () => {
    const view = interpretLearnResponse(true, { outcome: "unchanged", edits: [], candidates: [], pending: [], message: "Sent exactly as drafted, with no edits." });
    expect(view.kind).toBe("unchanged");
    expect(view.rules).toEqual([]);
  });

  it("surfaces a non-JSON or failed response as an error, not as success", () => {
    const view = interpretLearnResponse(false, { error: "<html>Bad gateway</html>" });
    expect(view.kind).toBe("error");
    expect(view.toastOk).toBe(false);
    expect(view.clearSentText).toBe(false);
    const empty = interpretLearnResponse(false, {});
    expect(empty.kind).toBe("error");
    expect(empty.toast.length).toBeGreaterThan(0);
  });
});
