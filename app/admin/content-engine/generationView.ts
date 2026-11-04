// How one content type's progress reads in the Generation section, decided
// from the stored entry and the (server-corrected) clock — never from what a
// browser request happened to return. Pure, so it is unit-tested directly and
// the JSX only renders it.
//
// The rule that matters: a `processing` entry is only "running" while its
// lease is live. Once the lease lapses the invocation that held it is gone,
// and the type is "stalled" — reclaimable by Retry (claim_generation_type
// takes expired leases). Skip stays limited to recorded failures: a stalled
// type was never recorded, and a live one may still be writing.
import {
  effectiveGenerationState, leaseExpiresAtMs,
  type EffectiveGenerationState, type GenerationProgressEntry,
} from "@/lib/contentEngine/generationProgress";
import { CONTENT_TYPE_LABELS } from "./engineTypes";
import type { GenerationOutcome } from "./pipeline";

export interface GenerationRowView {
  state: EffectiveGenerationState;
  /** Chip text. */
  label: string;
  canGenerate: boolean;
  generateLabel: "Generate" | "Retry";
  canSkip: boolean;
  /** One line under the row explaining a running or stalled claim. */
  hint: string | null;
}

const secondsAgo = (iso: string | null | undefined, nowMs: number): number | null => {
  if (typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.max(0, Math.round((nowMs - ms) / 1000)) : null;
};

function runningHint(entry: GenerationProgressEntry, nowMs: number): string {
  const started = secondsAgo(entry.lease_started_at, nowMs);
  const since = started === null ? "" : ` ${started}s ago`;
  return `Started${since} — the server is still working on it; this refreshes on its own until it finishes or the claim lapses.`;
}

function stalledHint(entry: GenerationProgressEntry, nowMs: number): string {
  const expiresAt = leaseExpiresAtMs(entry);
  const lapsed = expiresAt === null ? "" : ` ${Math.max(0, Math.round((nowMs - expiresAt) / 1000))}s ago`;
  return `The server claim lapsed${lapsed} without a result (the request was cut off) — Retry to pick it up again.`;
}

export function generationRowView(entry: GenerationProgressEntry | undefined, nowMs: number): GenerationRowView {
  const state = effectiveGenerationState(entry, nowMs);
  switch (state) {
    case "running":
      return { state, label: "running", canGenerate: false, generateLabel: "Retry", canSkip: false, hint: runningHint(entry!, nowMs) };
    case "stalled":
      return { state, label: "stalled", canGenerate: true, generateLabel: "Retry", canSkip: false, hint: stalledHint(entry!, nowMs) };
    case "failed":
      return { state, label: "failed", canGenerate: true, generateLabel: "Retry", canSkip: true, hint: null };
    case "pending":
      return { state, label: "pending", canGenerate: true, generateLabel: "Generate", canSkip: false, hint: null };
    default:
      return { state, label: state, canGenerate: false, generateLabel: "Generate", canSkip: false, hint: null };
  }
}

const labelFor = (type: string) => CONTENT_TYPE_LABELS[type] ?? type;

/**
 * The notice for a request that did not complete, read against the refreshed
 * entry. Points at Retry/Skip only when those controls are actually there,
 * and clears itself once the server has moved the type on without us.
 */
export function generationNotice(
  outcome: GenerationOutcome, entry: GenerationProgressEntry | undefined, nowMs: number,
): string | null {
  const label = labelFor(outcome.type);
  const state = effectiveGenerationState(entry, nowMs);
  if (state === "completed" || state === "skipped") return null;
  if (state === "failed") {
    const detail = outcome.kind === "failed" ? outcome.message : (entry?.error ?? outcome.message);
    return `${label}: ${detail} — retry or skip below`;
  }
  switch (outcome.kind) {
    case "unreachable":
      if (state === "running") {
        return `${label}: the request timed out in the browser, but the server still holds this step — watching it.`;
      }
      if (state === "stalled") {
        return `${label}: stalled — the request was cut off before a result was recorded. Retry below.`;
      }
      return `${label}: ${outcome.message}`;
    case "conflict":
      if (state === "running") return `${label}: another request is already generating this — watching it.`;
      if (state === "stalled") return `${label}: stalled — retry below.`;
      return null;
    default:
      return `${label}: ${outcome.message}`;
  }
}
