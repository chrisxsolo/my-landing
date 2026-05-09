"use client";

import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_SHORT_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type AdminSessionStatusStripProps = {
  currentStatus: ClientSessionStatus;
  savingStatus?: ClientSessionStatus | null;
  onSelect: (status: ClientSessionStatus) => void;
  disabled?: boolean;
  compact?: boolean;
};

function getStepStyles(
  state: "completed" | "current" | "upcoming",
  disabled: boolean,
) {
  if (disabled) {
    return {
      background: C.surfaceStrong,
      borderColor: C.borderSubtle,
      color: C.muted,
    };
  }

  if (state === "current") {
    return {
      background: C.grad12,
      borderColor: "transparent",
      color: C.white,
      boxShadow: C.shadowWarmSm,
    };
  }

  if (state === "completed") {
    return {
      background: C.p1_08,
      borderColor: C.p1_20,
      color: C.p1,
    };
  }

  return {
    background: C.surfaceStrong,
    borderColor: C.borderSubtle,
    color: C.inkSoft,
  };
}

export default function AdminSessionStatusStrip({
  currentStatus,
  savingStatus = null,
  onSelect,
  disabled = false,
  compact = false,
}: AdminSessionStatusStripProps) {
  const progress = getClientSessionProgress(currentStatus);

  return (
    <div className="flex flex-wrap gap-2">
      {progress.map((step, index) => {
        const buttonDisabled = disabled || savingStatus !== null;
        const isSaving = savingStatus === step.value;

        return (
          <button
            key={step.value}
            type="button"
            onClick={() => onSelect(step.value)}
            disabled={buttonDisabled}
            className={[
              "inline-flex items-center gap-2 rounded-full border font-black uppercase tracking-[0.12em] transition-transform duration-200",
              compact ? "min-h-9 px-3 py-2 text-[10px]" : "min-h-10 px-3.5 py-2 text-[10px]",
              buttonDisabled ? "cursor-wait opacity-80" : "hover:-translate-y-0.5",
            ].join(" ")}
            style={getStepStyles(step.state, buttonDisabled && !isSaving)}
            aria-pressed={step.state === "current"}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px]"
              style={{
                background: step.state === "current" ? "rgba(255,255,255,0.18)" : C.surface,
                color: step.state === "current" ? C.white : C.p1,
              }}
            >
              {isSaving ? "..." : index + 1}
            </span>
            <span>{CLIENT_SESSION_STATUS_SHORT_LABELS[step.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
