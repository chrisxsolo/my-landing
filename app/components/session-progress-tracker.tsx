import {
  CLIENT_SESSION_STATUS_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type SessionProgressTrackerProps = {
  status: ClientSessionStatus;
};

const TRACKER_STYLES = `
  .spt-rail {
    height: 2px;
    background: rgba(0,0,0,0.07);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }

  .spt-fill {
    height: 100%;
    border-radius: inherit;
    background: rgba(0,0,0,0.40);
    animation: spt-fill-in 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms both;
  }
  @keyframes spt-fill-in {
    from { width: 0% !important; }
  }

  .spt-step {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    position: relative;
    animation: spt-step-in 380ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
    transition: border-color 180ms ease, background 180ms ease;
  }
  .spt-step:nth-child(1)  { animation-delay: 80ms;  }
  .spt-step:nth-child(2)  { animation-delay: 120ms; }
  .spt-step:nth-child(3)  { animation-delay: 160ms; }
  .spt-step:nth-child(4)  { animation-delay: 200ms; }
  .spt-step:nth-child(5)  { animation-delay: 240ms; }
  .spt-step:nth-child(6)  { animation-delay: 280ms; }
  .spt-step:nth-child(7)  { animation-delay: 320ms; }
  .spt-step:nth-child(8)  { animation-delay: 360ms; }
  .spt-step:nth-child(9)  { animation-delay: 400ms; }
  @keyframes spt-step-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .spt-step[data-state="completed"] {
    background: rgba(0,0,0,0.03);
    border-color: rgba(0,0,0,0.07);
  }

  .spt-step[data-state="current"] {
    background: rgba(0,0,0,0.05);
    border-color: rgba(0,0,0,0.12);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    animation: spt-step-in 380ms cubic-bezier(0.22, 0.68, 0, 1.05) both,
               spt-current-glow 600ms cubic-bezier(0.22, 0.68, 0, 1.2) 500ms both;
  }
  @keyframes spt-current-glow {
    0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0.12); }
    50%  { box-shadow: 0 0 0 4px rgba(0,0,0,0.05); }
    100% { box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  }

  .spt-step[data-state="upcoming"] {
    background: transparent;
    border-color: rgba(0,0,0,0.04);
  }

  .spt-mono {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .spt-fill, .spt-step { animation: none !important; }
  }
`;

export default function SessionProgressTracker({ status }: SessionProgressTrackerProps) {
  const steps = getClientSessionProgress(status);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const currentStep = steps[activeIndex] ?? steps[0];
  const nextStep = steps[activeIndex + 1] ?? null;
  const completedCount = steps.filter((s) => s.state === "completed").length;
  const progressPercent = steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div aria-label={`Current status: ${CLIENT_SESSION_STATUS_LABELS[status]}`}>
      <style>{TRACKER_STYLES}</style>

      {/* Mobile: compact summary */}
      <div className="md:hidden">
        <div style={{
          background: "rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: "12px",
          padding: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
            <div>
              <div className="spt-mono" style={{ color: "rgba(0,0,0,0.50)", marginBottom: "6px" }}>
                Current step
              </div>
              <div style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "rgba(0,0,0,0.82)",
                lineHeight: 1.2,
              }}>
                {currentStep.label}
              </div>
              {nextStep && (
                <div style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "rgba(0,0,0,0.55)",
                }}>
                  Next: {nextStep.label}
                </div>
              )}
            </div>
            <div className="spt-mono" style={{
              color: "rgba(0,0,0,0.52)",
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "6px",
              padding: "5px 9px",
              flexShrink: 0,
            }}>
              {activeIndex + 1} / {steps.length}
            </div>
          </div>

          {/* Rail */}
          <div className="spt-rail">
            <div className="spt-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div style={{
            marginTop: "12px",
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
          }}>
            {steps.map((step, index) => (
              <span
                key={step.value}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  fontWeight: step.state === "current" ? 500 : 400,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: step.state === "current"
                    ? "rgba(0,0,0,0.82)"
                    : step.state === "completed"
                    ? "rgba(0,0,0,0.55)"
                    : "rgba(0,0,0,0.32)",
                  background: step.state === "current"
                    ? "rgba(0,0,0,0.06)"
                    : "transparent",
                  border: `1px solid ${step.state === "current" ? "rgba(0,0,0,0.10)" : "transparent"}`,
                  borderRadius: "5px",
                  padding: step.state === "current" ? "3px 7px" : "3px 4px",
                }}
              >
                {index + 1}. {step.label}
              </span>
            ))}
          </div>

          <div className="spt-mono" style={{ color: "rgba(0,0,0,0.48)", marginTop: "12px" }}>
            {completedCount} completed · {steps.length - activeIndex - 1} remaining
          </div>
        </div>
      </div>

      {/* Desktop: step grid */}
      <div className="hidden md:block">
        {/* Rail */}
        <div className="spt-rail" style={{ marginBottom: "14px" }}>
          <div className="spt-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: "6px",
        }}>
          {steps.map((step, index) => (
            <div
              key={step.value}
              className="spt-step"
              data-state={step.state}
            >
              <div className="spt-mono" style={{
                color: step.state === "current"
                  ? "rgba(0,0,0,0.55)"
                  : step.state === "completed"
                  ? "rgba(0,0,0,0.42)"
                  : "rgba(0,0,0,0.28)",
                marginBottom: "6px",
              }}>
                {String(index + 1).padStart(2, "0")}
              </div>
              <div style={{
                fontSize: "11px",
                fontWeight: step.state === "current" ? 700 : 500,
                lineHeight: 1.3,
                color: step.state === "current"
                  ? "rgba(0,0,0,0.85)"
                  : step.state === "completed"
                  ? "rgba(0,0,0,0.60)"
                  : "rgba(0,0,0,0.38)",
              }}>
                {step.label}
              </div>
              {step.state === "current" && (
                <div className="spt-mono" style={{
                  color: "rgba(0,0,0,0.50)",
                  marginTop: "6px",
                }}>
                  Active
                </div>
              )}
              {step.state === "completed" && (
                <div className="spt-mono" style={{
                  color: "rgba(0,0,0,0.38)",
                  marginTop: "6px",
                }}>
                  Done
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
