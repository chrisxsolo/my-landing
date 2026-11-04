// ─────────────────────────────────────────────────────────────────────────────
// Which AI draft "Learn from reply" compares against, and how the panel reads
// the route's structured outcome. Pure: no React, no fetch.
//
// The compose cycle:
//   - an AI generation starts a cycle; every later AI operation (refine,
//     regenerate, shorten, naturalize, polish) replaces the latest AI draft
//   - Chris's own typing changes the compose draft, never the AI baseline
//   - a completed send ends the cycle: the persisted draft, ai_draft and
//     original_ai_draft are deleted, and the latest AI draft is kept only in
//     memory (sentCycleAiDraft) until the next generation or a page reload
//
// The baseline is always the LATEST AI output, never the first draft of the
// cycle: that is the text Chris actually edited into what he sent.
// ─────────────────────────────────────────────────────────────────────────────

import type { DraftKind } from "@/lib/siteSettingsShared";

/** Every persisted draft kind a completed send clears, server and local. */
export const SEND_CLEARED_DRAFT_KINDS: readonly DraftKind[] = ["draft", "ai_draft", "original_ai_draft"];

export type LearnBaselineSource = "latest_ai" | "sent_cycle" | "manual" | "none";
export type LearnBaseline = { text: string; source: LearnBaselineSource };

export type LearnBaselineInputs = {
  lastAiDraft: string;
  /** Kept for the regeneration metric only. Deliberately never a baseline. */
  originalAiDraft: string;
  sentCycleAiDraft: string;
  manualAiDraft: string;
};

export function selectLearnBaseline(inputs: LearnBaselineInputs): LearnBaseline {
  if (inputs.lastAiDraft) return { text: inputs.lastAiDraft, source: "latest_ai" };
  if (inputs.sentCycleAiDraft) return { text: inputs.sentCycleAiDraft, source: "sent_cycle" };
  const manual = inputs.manualAiDraft.trim();
  if (manual) return { text: manual, source: "manual" };
  return { text: "", source: "none" };
}

export const BASELINE_LABELS: Record<Exclude<LearnBaselineSource, "none" | "manual">, string> = {
  latest_ai: "Latest AI draft before your edits",
  sent_cycle: "AI draft you edited and sent",
};

// ── Reading the route's response ─────────────────────────────────────────────

type LearnEdit = { kind?: string; category?: string; description?: string };
type LearnCandidate = { rule?: string; intake?: { verdict?: string } };
type LearnJson = {
  outcome?: string;
  edits?: LearnEdit[];
  candidates?: LearnCandidate[];
  pending?: { id?: string; rule?: string }[];
  message?: string;
  error?: string;
  error_code?: string;
  retryable?: boolean;
};

export type LearnViewKind = "error" | "unchanged" | "factual_only" | "no_rule" | "rules_pending" | "retry";

export type LearnView = {
  kind: LearnViewKind;
  toast: string;
  toastOk: boolean;
  /** Corrections to this one email, shown but never saved as rules. */
  factualEdits: string[];
  /** Rules actually stored as pending. Empty unless the server confirmed the write. */
  rules: string[];
  /** Whether the pasted sent email can be dropped. False whenever a retry may help. */
  clearSentText: boolean;
};

const GENERIC_ERROR = "Could not analyze the edit. Your text is still here; try again.";

function factualDescriptions(edits: LearnEdit[] | undefined): string[] {
  return (edits ?? [])
    .filter((edit) => edit.category === "factual" && typeof edit.description === "string")
    .map((edit) => edit.description as string);
}

/** Turns the HTTP outcome plus parsed body into what the panel should show. */
export function interpretLearnResponse(ok: boolean, json: Record<string, unknown>): LearnView {
  const body = json as LearnJson;
  const factualEdits = factualDescriptions(body.edits);
  const base = { factualEdits, rules: [] as string[], clearSentText: false };

  if (!ok || typeof body.outcome !== "string") {
    const raw = typeof body.error === "string" ? body.error : "";
    const toast = raw && !/^\s*</.test(raw) ? raw : GENERIC_ERROR;
    return { ...base, kind: "error", toast, toastOk: false };
  }

  const message = body.message ?? "";
  switch (body.outcome) {
    case "unchanged":
      return { ...base, kind: "unchanged", toast: message || "Sent exactly as drafted, with no edits.", toastOk: false };
    case "factual_only":
      return { ...base, kind: "factual_only", toast: message || "Only facts changed, so there is no writing preference to learn.", toastOk: false };
    case "rules_pending": {
      const rules = (body.pending ?? []).map((row) => row.rule).filter((rule): rule is string => typeof rule === "string");
      return {
        ...base, kind: "rules_pending", rules, clearSentText: true, toastOk: true,
        toast: `${rules.length} rule${rules.length === 1 ? "" : "s"} waiting for approval on the AI tab`,
      };
    }
    case "no_general_rule":
    case "style_candidates":
      return { ...base, kind: "no_rule", toast: message || "No general rule came out of these edits.", toastOk: false };
    case "phrasing_failed":
    case "persist_failed":
      return { ...base, kind: "retry", toast: message || GENERIC_ERROR, toastOk: false };
    default:
      return { ...base, kind: "error", toast: GENERIC_ERROR, toastOk: false };
  }
}
