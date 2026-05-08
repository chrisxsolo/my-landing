import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type SessionProgressTrackerProps = {
  status: ClientSessionStatus;
};

export default function SessionProgressTracker({ status }: SessionProgressTrackerProps) {
  const steps = getClientSessionProgress(status);

  return (
    <div aria-label={`Current status: ${CLIENT_SESSION_STATUS_LABELS[status]}`}>
      <div className="grid gap-3 md:grid-cols-7">
        {steps.map((step, index) => {
          const isCompleted = step.state === "completed";
          const isCurrent = step.state === "current";
          const stepBg = isCurrent ? C.grad12 : isCompleted ? C.surfaceWarm : C.surfaceStrong;
          const border = isCurrent ? C.p1_35 : isCompleted ? C.p2_20 : C.borderSubtle;
          const textColor = isCurrent ? C.white : isCompleted ? C.p1 : C.muted;

          return (
            <div key={step.value} className="relative">
              <div
                className="min-h-[96px] rounded-lg border p-3 transition-transform md:min-h-[128px]"
                style={{
                  background: stepBg,
                  borderColor: border,
                  boxShadow: isCurrent ? C.shadowWarm : "none",
                }}
              >
                <div
                  className="mb-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black"
                  style={{
                    background: isCurrent ? C.white_22 : C.p1_08,
                    color: textColor,
                  }}
                >
                  {index + 1}
                </div>
                <div className="text-sm font-black leading-tight" style={{ color: textColor }}>
                  {step.label}
                </div>
                <div
                  className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: isCurrent ? C.white_82 : C.mutedSoft }}
                >
                  {step.state}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
