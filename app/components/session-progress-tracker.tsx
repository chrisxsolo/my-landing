import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type SessionProgressTrackerProps = {
  status: ClientSessionStatus;
};

function getStateLabel(state: "completed" | "current" | "upcoming") {
  if (state === "completed") return "Complete";
  if (state === "current") return "Current";
  return "Upcoming";
}

export default function SessionProgressTracker({ status }: SessionProgressTrackerProps) {
  const steps = getClientSessionProgress(status);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const progressPercent = steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div aria-label={`Current status: ${CLIENT_SESSION_STATUS_LABELS[status]}`}>
      <style>{`
        .session-progress-rail {
          border-radius: 999px;
          height: 6px;
          overflow: hidden;
        }

        .session-progress-fill {
          animation: tracker-fill 700ms cubic-bezier(.2,.8,.2,1) both;
          border-radius: inherit;
          height: 100%;
        }

        .session-step-card {
          animation: tracker-step 520ms cubic-bezier(.2,.8,.2,1) both;
          transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
        }

        .session-step-card:hover {
          transform: translateY(-3px);
        }

        .session-step-card[data-state="current"] {
          transform: translateY(-4px);
        }

        @keyframes tracker-step {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes tracker-fill {
          from { width: 0%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .session-progress-fill,
          .session-step-card {
            animation: none;
            transition: none;
          }

          .session-step-card:hover,
          .session-step-card[data-state="current"] {
            transform: none;
          }
        }
      `}</style>

      <div className="mb-5 rounded-full p-1" style={{ background: C.surfaceStrong }}>
        <div className="session-progress-rail" style={{ background: C.p1_08 }}>
          <div
            className="session-progress-fill"
            style={{ width: `${progressPercent}%`, background: C.grad90 }}
          />
        </div>
      </div>

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
                className="session-step-card min-h-[96px] rounded-2xl border p-3 md:min-h-[128px]"
                data-state={step.state}
                style={{
                  background: stepBg,
                  borderColor: border,
                  boxShadow: isCurrent ? C.shadowWarm : "none",
                  animationDelay: `${index * 55}ms`,
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
                  {getStateLabel(step.state)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
