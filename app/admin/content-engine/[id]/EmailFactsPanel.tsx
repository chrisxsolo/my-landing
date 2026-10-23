"use client";
// Review panel for facts read out of the client's email conversation.
//
// Nothing here writes. Each suggestion is ticked or left alone, "Apply" drops
// the accepted values into the facts form, and Save facts is still the only
// thing that commits — so an extraction can never quietly overwrite a value
// the photographer typed. Fills arrive pre-ticked; a disagreement with an
// existing value never does.
import { useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import {
  isDefaultAccepted, type FactSuggestion, type MergeAction,
} from "@/lib/contentEngine/emailFacts/merge";
import type { EmailFactField } from "@/lib/contentEngine/emailFacts/fields";
import type { DroppedFact } from "@/lib/contentEngine/emailFacts/extract";
import type { ThreadSummary } from "@/lib/contentEngine/emailFacts/run";
import { btn, chip, label } from "./ui";

interface Props {
  suggestions: FactSuggestion[];
  threads: ThreadSummary[];
  messageCount: number;
  dropped: DroppedFact[];
  onApply: (values: Partial<Record<EmailFactField, string>>) => void;
  onDismiss: () => void;
}

const CONFIDENCE_CHIP: Record<FactSuggestion["confidence"], [string, string]> = {
  high: [T.green, T.greenBg],
  medium: [T.blue, T.blueBg],
  low: [T.inkSoft, T.neutralBg],
};

const ACTION_LABEL: Record<MergeAction, string> = {
  fill: "Empty — suggested",
  conflict: "Differs from what is saved",
  unchanged: "Already matches",
};

const pretty = (value: string) => value.replace(/_/g, " ");
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

export default function EmailFactsPanel({
  suggestions, threads, messageCount, dropped, onApply, onDismiss,
}: Props) {
  const actionable = useMemo(
    () => suggestions.filter((s) => s.action !== "unchanged"),
    [suggestions],
  );
  const unchanged = suggestions.filter((s) => s.action === "unchanged");

  const [accepted, setAccepted] = useState<Set<EmailFactField>>(
    () => new Set(actionable.filter(isDefaultAccepted).map((s) => s.field)),
  );

  const toggle = (field: EmailFactField) =>
    setAccepted((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });

  const acceptAll = () => setAccepted(new Set(actionable.map((s) => s.field)));

  const apply = () => {
    const values: Partial<Record<EmailFactField, string>> = {};
    for (const suggestion of actionable) {
      if (accepted.has(suggestion.field)) values[suggestion.field] = suggestion.proposedValue;
    }
    onApply(values);
  };

  return (
    <div style={{
      border: `1px solid ${T.amberBorder}`, background: T.inset, borderRadius: 12,
      padding: 12, marginTop: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <strong style={{ fontSize: 14 }}>
          {actionable.length
            ? "Session facts extracted — review the details before saving."
            : "Nothing new found in the email conversation."}
        </strong>
        <button style={btn()} onClick={onDismiss}>Close</button>
      </div>

      <p style={{ fontSize: 12, color: T.inkFaint, fontFamily: T.mono, margin: "6px 0 10px" }}>
        {messageCount} message{messageCount === 1 ? "" : "s"} read
        {threads.length ? ` · ${threads.map((t) => t.subject).join(" · ")}` : ""}
      </p>

      {actionable.map((suggestion) => {
        const [color, bg] = CONFIDENCE_CHIP[suggestion.confidence];
        const on = accepted.has(suggestion.field);
        return (
          <div key={suggestion.field} style={{
            borderTop: `1px solid ${T.rowBorder}`, padding: "10px 0",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <input type="checkbox" checked={on} onChange={() => toggle(suggestion.field)}
              style={{ marginTop: 3, accentColor: T.action }}
              aria-label={`Accept ${suggestion.label} from email`} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{suggestion.label}</span>
                <span style={chip(color, bg)}>{suggestion.confidence}</span>
                <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.mono }}>
                  {pretty(suggestion.status)}
                </span>
                {suggestion.internal && (
                  <span style={chip(T.violet, T.violetBg)}>private</span>
                )}
                <span style={{
                  fontSize: 11, color: suggestion.action === "conflict" ? T.amber : T.inkFaint,
                }}>
                  {ACTION_LABEL[suggestion.action]}
                </span>
              </div>

              {suggestion.action === "conflict" && (
                <p style={{ fontSize: 12, color: T.inkSoft, margin: "4px 0 0" }}>
                  Current: <span style={{ color: T.ink }}>{suggestion.currentValue}</span>
                </p>
              )}
              <p style={{ fontSize: 13, color: T.ink, margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
                {suggestion.action === "conflict" ? "From email: " : ""}{suggestion.proposedValue}
              </p>
              {suggestion.evidence && (
                <p style={{ fontSize: 12, color: T.inkFaint, margin: "4px 0 0" }}>
                  {day(suggestion.sourceAt) ? `${day(suggestion.sourceAt)} email · ` : ""}
                  <em>“{suggestion.evidence}”</em>
                </p>
              )}
            </div>
          </div>
        );
      })}

      {unchanged.length > 0 && (
        <p style={{ fontSize: 12, color: T.inkFaint, margin: "10px 0 0" }}>
          Already matches the conversation: {unchanged.map((s) => s.label).join(", ")}.
        </p>
      )}

      {dropped.length > 0 && (
        <p style={{ fontSize: 12, color: T.inkFaint, margin: "6px 0 0" }}>
          Left alone for lack of solid evidence:{" "}
          {dropped.map((d) => `${d.field} (${d.reason})`).join(", ")}.
        </p>
      )}

      {actionable.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <button style={btn(true)} onClick={apply} disabled={accepted.size === 0}>
            Apply {accepted.size} to form
          </button>
          <button style={btn()} onClick={acceptAll}>Accept all suggested changes</button>
          <span style={{ ...label, margin: 0, textTransform: "none", letterSpacing: 0 }}>
            Applying fills the form — Save facts still commits it
          </span>
        </div>
      )}
    </div>
  );
}
