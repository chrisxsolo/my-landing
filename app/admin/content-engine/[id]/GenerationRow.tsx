"use client";
// One content type in the Generation section. Everything it shows comes from
// generationRowView (lease-aware), so a `processing` type reads as running
// while its server claim is live and as stalled — with Retry — once the
// claim lapses. Skip only ever appears on a recorded failure.
import { T } from "@/app/admin/adminTheme";
import { CONTENT_TYPE_LABELS } from "@/app/admin/content-engine/engineTypes";
import { generationRowView } from "@/app/admin/content-engine/generationView";
import type { GenerationProgressEntry } from "@/lib/contentEngine/generationProgress";
import { btn, chip } from "./ui";

interface Props {
  type: string;
  entry: GenerationProgressEntry | undefined;
  nowMs: number;
  busy: boolean;
  /** Why a pending/skipped type is where it is (facts to set, no guide, …). */
  reason: string | null;
  onGenerate: () => void;
  onSkip: () => void;
}

const STATE_COLOR: Record<string, string> = {
  failed: T.red, stalled: T.amber, running: T.blue, completed: T.ink,
};

export default function GenerationRow({ type, entry, nowMs, busy, reason, onGenerate, onSkip }: Props) {
  const view = generationRowView(entry, nowMs);
  const color = STATE_COLOR[view.state] ?? T.inkSoft;
  const note = view.hint ?? reason;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <span>{CONTENT_TYPE_LABELS[type] ?? type}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {entry?.usage && (
            <span style={{ color: T.inkSoft, fontSize: 11 }}>
              {entry.usage.input_tokens + entry.usage.output_tokens} tok
            </span>
          )}
          <span style={chip(color, T.inset)} title={entry?.error ?? undefined}>{view.label}</span>
          {view.canGenerate && (
            <button style={btn(false)} disabled={busy} onClick={onGenerate}>
              {busy ? "Generating…" : view.generateLabel}
            </button>
          )}
          {view.canSkip && (
            <button style={btn(false)} disabled={busy} onClick={onSkip}>Skip</button>
          )}
        </span>
      </div>
      {note && <span style={{ fontSize: 11, color: view.hint ? color : T.inkSoft, lineHeight: 1.4 }}>{note}</span>}
    </div>
  );
}
