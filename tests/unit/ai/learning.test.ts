import { describe, it, expect } from "vitest";
import { detectEdits, isFactualOnly } from "@/lib/ai/correctionDiff";
import {
  classifyRuleIntake, findConflicts, findDuplicate, ruleSimilarity,
  selectPromptRules, normalizeRule, type WritingRule,
} from "@/lib/ai/writingRules";
import { analyzeEditsDeterministically, learnFromEdit } from "@/lib/ai/learnFromEdit";
import { fakeCaller } from "./fixtures";

function rule(text: string, overrides: Partial<WritingRule> = {}): WritingRule {
  return {
    id: text.slice(0, 8), rule: text, category: "style", status: "approved",
    source: "test", createdAt: "2026-10-01T00:00:00Z", ...overrides,
  };
}

describe("factual edits never become style rules", () => {
  it("classifies a changed date as factual", () => {
    const edits = detectEdits(
      "Hi Sarah,\n\nI'm available October 25th!",
      "Hi Sarah,\n\nI'm available October 26th!",
    );
    expect(edits.every((e) => e.category === "factual")).toBe(true);
    expect(isFactualOnly(edits)).toBe(true);
  });

  it("classifies a changed price as factual", () => {
    const edits = detectEdits("Hi Sarah,\n\nThat's $350", "Hi Sarah,\n\nThat's $300");
    expect(edits.find((e) => e.kind === "price_changed")?.ruleCandidate).toBe(false);
  });

  it("classifies a changed time as factual", () => {
    const edits = detectEdits("Hi Sarah,\n\nLet's start at 6:15 pm", "Hi Sarah,\n\nLet's start at 6:30 pm");
    expect(edits.find((e) => e.kind === "time_changed")?.ruleCandidate).toBe(false);
  });

  it("classifies a corrected client name as factual", () => {
    const edits = detectEdits("Hi Caitlin,\n\nSounds good", "Hi Kaitlyn,\n\nSounds good");
    expect(edits.find((e) => e.kind === "name_changed")?.ruleCandidate).toBe(false);
  });

  it("makes no API call when every edit is factual", async () => {
    const call = fakeCaller("- should never be asked for");
    const result = await learnFromEdit({
      aiDraft: "Hi Sarah,\n\nHow about October 25th?",
      sentDraft: "Hi Sarah,\n\nHow about October 26th?",
      existingRules: [],
    }, call);

    expect(call.calls).toHaveLength(0);
    expect(result.candidates).toEqual([]);
    expect(result.message).toMatch(/no writing preference to learn/i);
  });
});

describe("stylistic edits are rule candidates", () => {
  it("detects a shortened draft", () => {
    const long = "Hi Sarah,\n\nThank you so much for reaching out, I really appreciate you considering me for this and I would absolutely love to be the one to take your graduation photos this year!\n\nLet me know!";
    const short = "Hi Sarah,\n\nI'd love to take your graduation photos!\n\nLet me know!";
    const edits = detectEdits(long, short);
    expect(edits.find((e) => e.kind === "shortened")?.ruleCandidate).toBe(true);
  });

  it("detects a changed closing", () => {
    const edits = detectEdits(
      "Hi Sarah,\n\nI'm free then!\n\nPlease advise which date is most convenient.",
      "Hi Sarah,\n\nI'm free then!\n\nLet me know if any of those work!",
    );
    expect(edits.some((e) => e.kind === "closing_changed" && e.ruleCandidate)).toBe(true);
  });

  it("detects a bulleted list turned into prose", () => {
    const edits = detectEdits(
      "Hi Sarah,\n\nOpen dates:\n- October 26th\n- October 28th",
      "Hi Sarah,\n\nI'm available October 26th or 28th!",
    );
    expect(edits.some((e) => e.kind === "formatting_changed")).toBe(true);
  });

  it("does not report a date swap inside a sentence as a cut plus an add", () => {
    const edits = detectEdits(
      "Hi Sarah,\n\nI'm available October 26th during golden hour!\n\nLet me know!",
      "Hi Sarah,\n\nI'm available October 28th during golden hour!\n\nLet me know!",
    );
    expect(edits.map((e) => e.kind)).not.toContain("phrase_removed");
    expect(edits.map((e) => e.kind)).not.toContain("phrase_added");
  });

  it("returns nothing at all for an unedited send", () => {
    const draft = "Hi Sarah,\n\nSounds great!";
    expect(detectEdits(draft, draft)).toEqual([]);
    expect(analyzeEditsDeterministically({ aiDraft: draft, sentDraft: draft, existingRules: [] }).message)
      .toMatch(/exactly as drafted/i);
  });

  it("makes exactly one API call when there is something stylistic to phrase", async () => {
    const call = fakeCaller("- Keep the first paragraph to one sentence");
    const result = await learnFromEdit({
      aiDraft: "Hi Sarah,\n\nThank you so much for reaching out, I really appreciate it and would love to work with you on this!\n\nLet me know!",
      sentDraft: "Hi Sarah,\n\nI'd love to shoot it!\n\nLet me know!",
      existingRules: [],
    }, call);

    expect(call.calls).toHaveLength(1);
    expect(result.candidates.map((c) => c.rule)).toEqual(["Keep the first paragraph to one sentence"]);
    expect(result.candidates[0].intake.verdict).toBe("new");
  });

  it("sends only the changed fragments, not the whole draft", async () => {
    const call = fakeCaller("- Keep it short");
    await learnFromEdit({
      aiDraft: "Hi Sarah,\n\nI'd love to shoot it!\n\nThis sentence was cut.\n\nThis one survived untouched and need not travel.",
      sentDraft: "Hi Sarah,\n\nI'd love to shoot it!\n\nThis one survived untouched and need not travel.",
      existingRules: [],
    }, call);

    const prompt = call.calls[0].userPrompt;
    // The cut sentence is the signal and has to be included to phrase a rule.
    expect(prompt).toMatch(/This sentence was cut/);
    // Sentences neither added nor removed carry no signal, so they stay local.
    expect(prompt).not.toMatch(/survived untouched/);
  });
});

describe("duplicate detection", () => {
  it("treats a reworded repeat as a duplicate", () => {
    const existing = [rule("Keep replies to three sentences or fewer")];
    expect(ruleSimilarity("Keep replies to 3 sentences or fewer", existing[0].rule))
      .toBeGreaterThan(0.8);
    expect(findDuplicate("Keep replies to 3 sentences or fewer", existing)).not.toBeNull();
  });

  it("normalises away bullets, date stamps, and punctuation", () => {
    expect(normalizeRule("- [2026-07-22] Keep it short!")).toBe("keep it short");
  });
});

describe("contradiction detection", () => {
  it("catches the greeting contradiction from the old rules note", () => {
    const existing = [rule("Open with the client's name as the greeting")];
    const conflicts = findConflicts('Omit personal greetings such as "Hi Anna," at the start', existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toMatch(/greeting/);
  });

  it("catches the bullet-list contradiction", () => {
    const existing = [rule("Use bullet points when presenting multiple dates")];
    expect(findConflicts("Never use a bullet list for dates, use a sentence", existing)).toHaveLength(1);
  });

  it("catches the length contradiction", () => {
    const existing = [rule("Keep the email length short, one to three paragraphs")];
    expect(findConflicts("Increase the level of detail and length throughout", existing)).toHaveLength(1);
  });

  it("does not call unrelated rules a conflict just because one says never", () => {
    const existing = [rule("Always use natural contractions")];
    expect(findConflicts("Never use emoji in an email", existing)).toHaveLength(0);
  });

  it("ignores rules that are not approved", () => {
    const existing = [rule("Open with the client's name as the greeting", { status: "pending" })];
    expect(findConflicts("Omit personal greetings at the start", existing)).toHaveLength(0);
  });

  it("reports a conflict instead of accepting the rule", () => {
    const existing = [rule("Use bullet points when presenting multiple dates")];
    const intake = classifyRuleIntake("Never use a bullet list for dates", existing);
    expect(intake.verdict).toBe("conflict");
  });
});

describe("prompt rule selection", () => {
  it("sends only approved style rules", () => {
    const rules = [
      rule("Approved style rule"),
      rule("Pending rule", { status: "pending" }),
      rule("Rejected rule", { status: "rejected" }),
      rule("Retired rule", { status: "superseded" }),
      rule("A business policy", { category: "policy" }),
      rule("A one-off correction", { category: "factual" }),
    ];
    expect(selectPromptRules(rules).map((r) => r.rule)).toEqual(["Approved style rule"]);
  });

  it("caps how many reach the prompt, newest first", () => {
    const rules = Array.from({ length: 30 }, (_, i) =>
      rule(`Rule number ${i}`, { createdAt: `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z` }),
    );
    const selected = selectPromptRules(rules, 20);
    expect(selected).toHaveLength(20);
    expect(selected[0].rule).toBe("Rule number 29");
  });
});

describe("approval-time conflict detection", () => {
  // Regression guard for a gap found while importing the 68 legacy rules:
  // intake only compares against APPROVED rules, so a batch arriving as
  // pending has nothing to contradict yet. The contradiction becomes real at
  // approval time, which is where it must also be checked — otherwise both
  // sides of the old note's greeting contradiction could go live together.
  it("finds no conflict among pending rules", () => {
    const pendingPair = [
      rule("Open with the client's name as the greeting", { status: "pending" }),
      rule('Omit personal greetings such as "Hi Anna," at the start', { status: "pending" }),
    ];
    expect(findConflicts(pendingPair[1].rule, pendingPair)).toHaveLength(0);
  });

  it("finds the conflict once the opposing rule is approved", () => {
    const approvedFirst = [rule("Open with the client's name as the greeting", { status: "approved" })];
    const conflicts = findConflicts('Omit personal greetings such as "Hi Anna," at the start', approvedFirst);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].existing.id).toBe(approvedFirst[0].id);
  });

  it("is resolvable by superseding the rule it contradicts", () => {
    const approved = [rule("Use bullet points when presenting multiple dates", { status: "approved" })];
    const candidate = "Never use a bullet list for dates, write them as a sentence";
    const conflicts = findConflicts(candidate, approved);

    // What the route does: filter out conflicts the caller agreed to retire.
    const supersedes = new Set(conflicts.map((c) => c.existing.id));
    const unresolved = conflicts.filter((c) => !supersedes.has(c.existing.id));
    expect(unresolved).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression: "Learn from reply" on a visibly different email.
//
// Synthetic stand-in for the reported case: a multi-paragraph proposal email
// where the sent version rewords sentences, adds and removes a question, and
// changes the price. The differ must find edits and keep the price change
// separate from the style changes. All names and figures here are invented.
// ─────────────────────────────────────────────────────────────────────────────

import { runLearnReview, type LearnDeps } from "@/lib/ai/learnService";

const PROPOSAL_AI_DRAFT = `Hi Jordan,

Thank you so much for reaching out! I'd love to photograph your proposal at Baker Beach!

My proposal sessions are $450 for one hour and include around 40 edited photos. If you'd like, I can also stay for a few portraits of the two of you afterward.

Would sunset on November 15th work for you? Do you know roughly where on the beach you're planning to ask?

Once we settle on the details I'll send over the invoice and contract to lock it in!`;

const PROPOSAL_SENT = `Hi Jordan,

Thanks for reaching out! I'd love to photograph your proposal at Baker Beach.

Proposal sessions are $475 for an hour with around 40 edited photos, and I usually stay for a few portraits of you two afterward.

Does sunset on November 15th work? Is there a spot on the beach you have in mind, and will anyone else be there with you?

Once the details are set I'll send the invoice and contract and we're locked in!`;

describe("a visibly different sent email is never 'exactly as drafted'", () => {
  it("finds edits and separates the price change from the wording changes", () => {
    const edits = detectEdits(PROPOSAL_AI_DRAFT, PROPOSAL_SENT);
    expect(edits.length).toBeGreaterThan(0);

    const price = edits.find((e) => e.kind === "price_changed");
    expect(price).toMatchObject({ category: "factual", ruleCandidate: false, before: "$450", after: "$475" });

    expect(edits.some((e) => e.category === "style" && e.ruleCandidate)).toBe(true);
    expect(isFactualOnly(edits)).toBe(false);

    const result = analyzeEditsDeterministically({ aiDraft: PROPOSAL_AI_DRAFT, sentDraft: PROPOSAL_SENT, existingRules: [] });
    expect(result.outcome).toBe("style_candidates");
    expect(result.message).not.toMatch(/exactly as drafted/i);
  });

  it("treats line endings and extra blank lines as no edit at all", () => {
    const crlf = PROPOSAL_AI_DRAFT.replace(/\n/g, "\r\n").replace(/\r\n\r\n/g, "\r\n\r\n\r\n") + "  \r\n";
    expect(detectEdits(PROPOSAL_AI_DRAFT, crlf)).toEqual([]);
    expect(analyzeEditsDeterministically({ aiDraft: PROPOSAL_AI_DRAFT, sentDraft: crlf, existingRules: [] }).outcome).toBe("unchanged");
  });

  it("still sees a real wording change under CRLF line endings", () => {
    const crlfEdited = PROPOSAL_AI_DRAFT.replace(/\n/g, "\r\n").replace("Thank you so much for reaching out!", "Thanks for reaching out!");
    const edits = detectEdits(PROPOSAL_AI_DRAFT, crlfEdited);
    expect(edits.length).toBeGreaterThan(0);
    expect(edits.some((e) => e.ruleCandidate)).toBe(true);
  });

  it("reports a factual-only outcome with a distinct code", () => {
    const result = analyzeEditsDeterministically({
      aiDraft: "Hi Sarah,\n\nThat's $350 for the hour",
      sentDraft: "Hi Sarah,\n\nThat's $375 for the hour",
      existingRules: [],
    });
    expect(result.outcome).toBe("factual_only");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The deterministic result survives whatever happens afterwards.
// ─────────────────────────────────────────────────────────────────────────────

function failingCaller(error: Error) {
  const calls: unknown[] = [];
  const caller = async (req: unknown) => { calls.push(req); throw error; };
  return Object.assign(caller, { calls });
}

function deps(overrides: Partial<LearnDeps> = {}): LearnDeps & { inserted: string[] } {
  const inserted: string[] = [];
  return {
    inserted,
    fetchRules: async () => [],
    insertRule: async (input) => {
      inserted.push(input.rule);
      return rule(input.rule, { id: `id-${inserted.length}`, status: "pending", source: "learn-from-edit" });
    },
    call: fakeCaller("- Keep the opening to a short thanks"),
    ...overrides,
  };
}

describe("model failure after deterministic success", () => {
  it("keeps the detected edits and reports a retryable learning failure", async () => {
    const call = failingCaller(new Error("529 overloaded_error"));
    const result = await learnFromEdit({ aiDraft: PROPOSAL_AI_DRAFT, sentDraft: PROPOSAL_SENT, existingRules: [] }, call);

    expect(call.calls).toHaveLength(1);
    expect(result.outcome).toBe("phrasing_failed");
    expect(result.edits.length).toBeGreaterThan(0);
    expect(result.edits.some((e) => e.kind === "price_changed")).toBe(true);
    expect(result.failure?.code).toBe("overloaded");
    expect(result.message).toMatch(new RegExp(`found ${result.edits.length} change`, "i"));
    expect(result.message).not.toMatch(/draft request failed|exactly as drafted/i);
  });

  it("does not call the model when there is nothing stylistic, even if the model is down", async () => {
    const call = failingCaller(new Error("should not be called"));
    const result = await learnFromEdit({
      aiDraft: "Hi Sarah,\n\nThat's $350", sentDraft: "Hi Sarah,\n\nThat's $375", existingRules: [],
    }, call);
    expect(call.calls).toHaveLength(0);
    expect(result.outcome).toBe("factual_only");
  });

  it("treats an empty model reply as a phrasing failure, not as no edits", async () => {
    const result = await learnFromEdit({ aiDraft: PROPOSAL_AI_DRAFT, sentDraft: PROPOSAL_SENT, existingRules: [] }, fakeCaller(""));
    expect(result.outcome).toBe("phrasing_failed");
    expect(result.failure?.code).toBe("empty_output");
    expect(result.edits.length).toBeGreaterThan(0);
  });

  it("treats prose with no rule lines as malformed output", async () => {
    const result = await learnFromEdit(
      { aiDraft: PROPOSAL_AI_DRAFT, sentDraft: PROPOSAL_SENT, existingRules: [] },
      fakeCaller("Sure! Here are some thoughts about the edits without any rules."),
    );
    expect(result.outcome).toBe("phrasing_failed");
    expect(result.failure?.code).toBe("empty_output");
  });

  it("reports NONE truthfully as no general rule, with the edits intact", async () => {
    const result = await learnFromEdit({ aiDraft: PROPOSAL_AI_DRAFT, sentDraft: PROPOSAL_SENT, existingRules: [] }, fakeCaller("NONE"));
    expect(result.outcome).toBe("no_general_rule");
    expect(result.candidates).toEqual([]);
    expect(result.edits.length).toBeGreaterThan(0);
  });
});

describe("runLearnReview: persistence is reported, never assumed", () => {
  const input = { aiDraft: PROPOSAL_AI_DRAFT, sentDraft: PROPOSAL_SENT };

  it("stores new candidates as pending exactly once and says so", async () => {
    const d = deps();
    const result = await runLearnReview(input, d);
    expect(result.outcome).toBe("rules_pending");
    expect(d.inserted).toEqual(["Keep the opening to a short thanks"]);
    expect(result.pending.map((p) => p.rule)).toEqual(["Keep the opening to a short thanks"]);
    expect(result.apiCalls).toBe(1);
  });

  it("does not claim rules are waiting when the insert failed", async () => {
    const d = deps({ insertRule: async () => null });
    const result = await runLearnReview(input, d);
    expect(result.outcome).toBe("persist_failed");
    expect(result.pending).toEqual([]);
    expect(result.failure?.code).toBe("rules_write");
    expect(result.edits.length).toBeGreaterThan(0);
    expect(result.message).not.toMatch(/waiting for (your )?approval/i);
  });

  it("does not store a duplicate pending rule on retry", async () => {
    const stored: WritingRule[] = [];
    const d = deps({
      fetchRules: async () => stored,
      insertRule: async (i) => { const r = rule(i.rule, { id: `id-${stored.length + 1}`, status: "pending" }); stored.push(r); return r; },
    });
    const first = await runLearnReview(input, d);
    expect(first.outcome).toBe("rules_pending");
    expect(stored).toHaveLength(1);

    const second = await runLearnReview(input, d);
    expect(stored).toHaveLength(1);
    expect(second.pending).toEqual([]);
    expect(second.outcome).toBe("no_general_rule");
    expect(second.candidates[0].intake.verdict).toBe("duplicate");
  });

  it("returns the edits with a configuration failure when no model is available", async () => {
    const result = await runLearnReview(input, deps({ call: null }));
    expect(result.outcome).toBe("phrasing_failed");
    expect(result.failure?.code).toBe("not_configured");
    expect(result.edits.length).toBeGreaterThan(0);
    expect(result.apiCalls).toBe(0);
  });

  it("returns a deterministic outcome without a model when nothing stylistic changed", async () => {
    const result = await runLearnReview(
      { aiDraft: "Hi Sarah,\n\nThat's $350", sentDraft: "Hi Sarah,\n\nThat's $375" },
      deps({ call: null }),
    );
    expect(result.outcome).toBe("factual_only");
    expect(result.apiCalls).toBe(0);
  });

  it("reports a rules-store read failure instead of guessing at duplicates", async () => {
    const d = deps({ fetchRules: async () => { throw new Error("connection refused"); } });
    const result = await runLearnReview(input, d);
    expect(result.outcome).toBe("phrasing_failed");
    expect(result.failure?.code).toBe("rules_read");
    expect(d.inserted).toEqual([]);
    expect(result.edits.length).toBeGreaterThan(0);
  });
});
