// Deciding what, if anything, to change about facts that are already there.
//
// Extraction never writes. It produces suggestions against the values
// currently in the facts form, and this module classifies each one:
//
//   fill       the field is empty and the conversation supports a value
//   conflict   both have a value and they disagree — the photographer chooses
//   unchanged  they already agree
//
// A field the conversation says nothing about produces no suggestion at all,
// so an existing value can never be cleared or replaced by a guess.
import { FIELD_SPECS, type EmailFactField, type FactConfidence, type FactStatus } from "./fields";
import type { ExtractedFact } from "./extract";

export type MergeAction = "fill" | "conflict" | "unchanged";

export interface FactSuggestion {
  field: EmailFactField;
  label: string;
  action: MergeAction;
  /** What the form holds now ("" when empty). */
  currentValue: string;
  /** What to put in the form if accepted — always the form's own format. */
  proposedValue: string;
  confidence: FactConfidence;
  status: FactStatus;
  evidence: string | null;
  sourceAt: string | null;
  sourceMessageId: string | null;
  /** Never published, never sent to a content-generation prompt. */
  internal: boolean;
}

/** The facts form keeps every field as a string; lists are comma-separated. */
export function toFormValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

const normalizeScalar = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function sameValue(field: EmailFactField, current: string, proposed: string): boolean {
  if (FIELD_SPECS[field].multi) {
    const parts = (value: string) =>
      value.split(",").map(normalizeScalar).filter(Boolean).sort().join("|");
    return parts(current) === parts(proposed);
  }
  return normalizeScalar(current) === normalizeScalar(proposed);
}

export function planFactMerge(
  facts: ExtractedFact[],
  current: Partial<Record<EmailFactField, string>>,
): FactSuggestion[] {
  const suggestions: FactSuggestion[] = [];

  for (const fact of facts) {
    const spec = FIELD_SPECS[fact.field];
    const proposedValue = toFormValue(fact.value);
    if (!proposedValue.trim()) continue; // never offer an empty value

    const currentValue = (current[fact.field] ?? "").toString();
    const action: MergeAction = !currentValue.trim()
      ? "fill"
      : sameValue(fact.field, currentValue, proposedValue)
        ? "unchanged"
        : "conflict";

    suggestions.push({
      field: fact.field,
      label: spec.label,
      action,
      currentValue,
      proposedValue,
      confidence: fact.confidence,
      status: fact.status,
      evidence: fact.evidence,
      sourceAt: fact.sourceAt,
      sourceMessageId: fact.sourceMessageId,
      internal: Boolean(spec.internal),
    });
  }

  // Fills first (the easy yeses), then conflicts, then what already agrees.
  const order: Record<MergeAction, number> = { fill: 0, conflict: 1, unchanged: 2 };
  return suggestions.sort((a, b) => order[a.action] - order[b.action]);
}

/** Pre-ticked on open: fills only. A disagreement is always an explicit call. */
export const isDefaultAccepted = (suggestion: FactSuggestion): boolean =>
  suggestion.action === "fill";
