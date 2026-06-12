"use client";
// The guided pipeline: Session → Photos → Analyze → Generate → Review → Publish.
// Maps the derived SessionEngineState onto a step index so the workspace always
// shows where you are and what comes next.
import { T } from "@/app/admin/adminTheme";
import type { SessionEngineState } from "@/lib/contentEngine/state";

export const WORKFLOW_STEPS = ["Session", "Photos", "Analyze", "Generate", "Review", "Publish"] as const;

/** Active step index (0-based); 6 means the whole pipeline is done. */
export function stepFromState(state: SessionEngineState): number {
  switch (state) {
    case "empty": return 1;
    case "uploaded": return 2;
    case "analyzing": return 2;
    case "analyzed": return 3;
    case "failed": return 3;
    case "generated": return 4;
    case "reviewed": return 5;
    case "publishing": return 5;
    case "partially_published": return 5;
    case "published": return 6;
  }
}

const STEP_HINTS: Record<SessionEngineState, string> = {
  empty: "Add session photos to get started",
  uploaded: "Photos in — run AI analysis next",
  analyzing: "Analysis running — keep this tab open",
  analyzed: "Analyzed — generate a content package",
  failed: "Generation needs attention — retry or skip the failed type",
  generated: "Drafts ready — review, edit, approve",
  reviewed: "Approved drafts waiting — publish when ready",
  publishing: "Publishing in progress…",
  partially_published: "Some items live — publish or fix the rest",
  published: "All published — this session's content is live ✓",
};

export default function WorkflowStepper({ state }: { state: SessionEngineState }) {
  const active = stepFromState(state);
  const stuck = state === "failed";
  return (
    <div className="rounded-2xl px-4 py-3 mb-4"
      style={{ background: T.panel, border: `1px solid ${stuck ? T.redBorder : T.border}`, boxShadow: T.shadow }}>
      <div className="flex items-center gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          const color = done ? T.green : current ? (stuck ? T.red : T.action) : T.inkFaint;
          return (
            <div key={step} className="flex items-center flex-shrink-0">
              {i > 0 && (
                <span className="w-5 md:w-8 h-px mx-1" style={{ background: done ? T.greenBorder : T.rowBorder }} />
              )}
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                  style={done
                    ? { background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }
                    : current
                      ? { background: stuck ? T.redBg : T.amberBg, color, border: `1px solid ${stuck ? T.redBorder : T.amberBorder}`, boxShadow: stuck ? undefined : T.glow }
                      : { background: T.inset, color, border: `1px solid ${T.border}` }}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: done ? T.inkSoft : color, fontFamily: T.mono }}>
                  {step}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-2 font-medium" style={{ color: stuck ? T.red : T.inkSoft }}>
        {STEP_HINTS[state]}
      </p>
    </div>
  );
}
