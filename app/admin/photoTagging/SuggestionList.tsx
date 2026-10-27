"use client";
// Tag suggestions for one photo. Accept fills the field (never overwrites);
// Dismiss records the rejection so the suggestion is never offered again.
// Competing suggestions (records that disagree) are marked "Pick one".
import { T } from "@/app/admin/adminTheme";
import { btn, chip } from "@/app/admin/content-engine/[id]/ui";
import type { TagSuggestion } from "@/lib/photoTagging/types";

const FIELD_LABEL: Record<TagSuggestion["field"], string> = {
  category: "Category", school: "University", location: "Location", spot: "Campus spot",
};

interface Props {
  suggestions: readonly TagSuggestion[];
  busy: boolean;
  onAccept: (s: TagSuggestion) => void;
  onDismiss: (s: TagSuggestion) => void;
}

export default function SuggestionList({ suggestions, busy, onAccept, onDismiss }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {suggestions.map((s) => (
        <div key={s.id} style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "6px 8px", borderRadius: 10, background: T.inset, border: `1px solid ${T.border}`,
        }}>
          <span style={chip(s.confidence === "high" ? T.green : T.amber, s.confidence === "high" ? T.greenBg : T.amberBg)}>
            {s.competing ? "Pick one" : s.confidence === "high" ? "High" : "Needs approval"}
          </span>
          <span style={{ fontSize: 13, color: T.ink, fontWeight: 700 }}>
            {FIELD_LABEL[s.field]}: {s.label}
          </span>
          <span style={{ fontSize: 12, color: T.inkSoft, flex: "1 1 180px" }}>
            {s.reason}{s.appliesTo === "session" ? " · sets the whole session" : ""}
          </span>
          <button type="button" style={{ ...btn(true), padding: "3px 10px", fontSize: 12 }} disabled={busy}
            onClick={() => onAccept(s)}>Accept</button>
          <button type="button" style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }} disabled={busy}
            onClick={() => onDismiss(s)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
