"use client";

import { T } from "@/app/admin/adminTheme";
import {
  CLIENT_SESSION_STATUS_SHORT_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type Appearance = "light" | "dark";

type AdminSessionStatusStripProps = {
  currentStatus: ClientSessionStatus;
  savingStatus?: ClientSessionStatus | null;
  onSelect: (status: ClientSessionStatus) => void;
  disabled?: boolean;
  compact?: boolean;
  appearance?: Appearance;
};

// Per-appearance palettes so the strip reads correctly on the Darkroom admin
// (dark) and the light /admin/sessions page alike.
const PALETTES = {
  dark: {
    track: T.inset,
    fill: `linear-gradient(90deg, ${T.green}, ${T.amber})`,
    fillGlow: `0 0 10px rgba(232,160,76,0.45)`,
    doneBg: T.greenBg,
    doneBorder: T.greenBorder,
    doneText: T.green,
    currentBg: T.action,
    currentText: T.actionText,
    currentGlow: T.glow,
    nextBg: "transparent",
    nextBorder: T.border,
    nextText: T.inkFaint,
    nextHoverBorder: T.borderStrong,
    nextHoverText: T.inkSoft,
    circleOnCurrent: "rgba(0,0,0,0.22)",
    pctText: T.inkFaint,
    mono: T.mono,
  },
  light: {
    track: "rgba(28,28,32,0.08)",
    fill: "linear-gradient(90deg, #1f7a5c, #b07c1e)",
    fillGlow: "none",
    doneBg: "rgba(31,122,92,0.10)",
    doneBorder: "rgba(31,122,92,0.25)",
    doneText: "#1f7a5c",
    currentBg: "#1c1c20",
    currentText: "#ffffff",
    currentGlow: "0 4px 14px rgba(16,18,22,0.25)",
    nextBg: "#ffffff",
    nextBorder: "rgba(28,28,32,0.12)",
    nextText: "#8e8e95",
    nextHoverBorder: "rgba(28,28,32,0.28)",
    nextHoverText: "#55555c",
    circleOnCurrent: "rgba(255,255,255,0.2)",
    pctText: "#8e8e95",
    mono: "ui-monospace, monospace",
  },
} as const;

export default function AdminSessionStatusStrip({
  currentStatus,
  savingStatus = null,
  onSelect,
  disabled = false,
  compact = false,
  appearance = "light",
}: AdminSessionStatusStripProps) {
  const progress = getClientSessionProgress(currentStatus);
  const P = PALETTES[appearance];

  const currentIdx = Math.max(progress.findIndex(s => s.state === "current"), 0);
  const pct = progress.length > 1 ? (currentIdx / (progress.length - 1)) * 100 : 0;
  const isComplete = currentIdx === progress.length - 1;

  return (
    <div>
      {/* Development rail — animated fill tracks the current stage */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: P.track }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.max(pct, 2)}%`,
              background: isComplete ? P.doneText : P.fill,
              boxShadow: P.fillGlow,
              transition: "width 0.6s cubic-bezier(0.22,1,0.36,1), background 0.3s",
            }}
          />
        </div>
        <span className="text-[10px] font-bold flex-shrink-0 tabular-nums" style={{ color: P.pctText, fontFamily: P.mono }}>
          {currentIdx + 1}/{progress.length}
        </span>
      </div>

      {/* Stage buttons — whole pill is the click target */}
      <div className="flex flex-wrap gap-1.5">
        {progress.map((step, index) => {
          const buttonDisabled = disabled || savingStatus !== null;
          const isSaving = savingStatus === step.value;
          const state = step.state;

          const style =
            state === "current"
              ? { background: P.currentBg, border: "1.5px solid transparent", color: P.currentText, boxShadow: P.currentGlow }
              : state === "completed"
                ? { background: P.doneBg, border: `1.5px solid ${P.doneBorder}`, color: P.doneText }
                : { background: P.nextBg, border: `1.5px solid ${P.nextBorder}`, color: P.nextText };

          return (
            <button
              key={step.value}
              type="button"
              onClick={() => onSelect(step.value)}
              disabled={buttonDisabled}
              className={[
                "inline-flex flex-1 items-center justify-start gap-2 rounded-xl font-bold transition-all duration-200",
                compact ? "min-h-9 min-w-[104px] px-2.5 text-[10px]" : "min-h-10 min-w-[118px] px-3 text-[11px]",
                buttonDisabled ? "cursor-wait" : "cursor-pointer hover:-translate-y-0.5 active:translate-y-0",
                isSaving ? "animate-pulse" : "",
              ].join(" ")}
              style={style}
              onMouseEnter={e => {
                if (state === "upcoming" && !buttonDisabled) {
                  e.currentTarget.style.borderColor = P.nextHoverBorder;
                  e.currentTarget.style.color = P.nextHoverText;
                }
              }}
              onMouseLeave={e => {
                if (state === "upcoming") {
                  e.currentTarget.style.borderColor = P.nextBorder;
                  e.currentTarget.style.color = P.nextText;
                }
              }}
              aria-pressed={state === "current"}
              title={state === "current" ? "Current stage" : `Set stage to ${CLIENT_SESSION_STATUS_SHORT_LABELS[step.value]}`}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black flex-shrink-0 transition-transform duration-200"
                style={{
                  background: state === "current" ? P.circleOnCurrent : state === "completed" ? P.doneText : P.track,
                  color: state === "current" ? P.currentText : state === "completed" ? (appearance === "dark" ? "#0d1f15" : "#ffffff") : P.nextText,
                  fontFamily: P.mono,
                }}
              >
                {isSaving ? <span className="animate-spin">◌</span> : state === "completed" ? "✓" : index + 1}
              </span>
              <span className="truncate uppercase tracking-[0.1em]">{CLIENT_SESSION_STATUS_SHORT_LABELS[step.value]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
