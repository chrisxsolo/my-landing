import {
  CLIENT_SESSION_STATUS_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import { G } from "@/lib/portalTheme";

type SessionProgressTrackerProps = {
  status: ClientSessionStatus;
};

const TRACKER_STYLES = `
  .spt-rail {
    height: 3px;
    background: ${G.inset};
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }

  .spt-fill {
    height: 100%;
    border-radius: inherit;
    background: ${G.accent};
    animation: spt-fill-in 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms both;
  }
  @keyframes spt-fill-in {
    from { width: 0% !important; }
  }

  .spt-step {
    flex: 1;
    min-width: 0;
    padding: 11px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
    animation: spt-step-in 380ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
  }
  .spt-step:nth-child(1) { animation-delay: 80ms; }
  .spt-step:nth-child(2) { animation-delay: 120ms; }
  .spt-step:nth-child(3) { animation-delay: 160ms; }
  .spt-step:nth-child(4) { animation-delay: 200ms; }
  .spt-step:nth-child(5) { animation-delay: 240ms; }
  .spt-step:nth-child(6) { animation-delay: 280ms; }
  .spt-step:nth-child(7) { animation-delay: 320ms; }
  .spt-step:nth-child(8) { animation-delay: 360ms; }
  .spt-step:nth-child(9) { animation-delay: 400ms; }
  @keyframes spt-step-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .spt-step[data-state="completed"] {
    background: ${G.greenBg};
    border-color: ${G.greenBorder};
  }
  .spt-step[data-state="current"] {
    background: ${G.accentBg};
    border-color: ${G.accentBorder};
  }
  .spt-step[data-state="upcoming"] {
    background: transparent;
    border-color: ${G.insetBorder};
  }

  .spt-mono {
    font-family: ${G.mono};
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.16em;
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
          background: G.inset,
          border: `1px solid ${G.insetBorder}`,
          borderRadius: "12px",
          padding: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
            <div>
              <div className="spt-mono" style={{ color: G.inkFaint, marginBottom: "6px" }}>
                Current step
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: G.ink, lineHeight: 1.2 }}>
                {currentStep.label}
              </div>
              {nextStep && (
                <div style={{ marginTop: "4px", fontSize: "12px", color: G.inkSoft }}>
                  Next: {nextStep.label}
                </div>
              )}
            </div>
            <div className="spt-mono" style={{
              color: G.accent,
              background: G.accentBg,
              border: `1px solid ${G.accentBorder}`,
              borderRadius: "6px",
              padding: "5px 9px",
              flexShrink: 0,
            }}>
              {activeIndex + 1} / {steps.length}
            </div>
          </div>

          <div className="spt-rail">
            <div className="spt-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="spt-mono" style={{ color: G.inkFaint, marginTop: "12px" }}>
            {completedCount} completed · {steps.length - activeIndex - 1} remaining
          </div>
        </div>
      </div>

      {/* Desktop: step grid */}
      <div className="hidden md:block">
        <div className="spt-rail" style={{ marginBottom: "14px" }}>
          <div className="spt-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: "6px" }}>
          {steps.map((step, index) => (
            <div key={step.value} className="spt-step" data-state={step.state}>
              <div className="spt-mono" style={{
                color: step.state === "current" ? G.accent : step.state === "completed" ? G.green : G.inkFaint,
                marginBottom: "6px",
              }}>
                {String(index + 1).padStart(2, "0")}
              </div>
              <div style={{
                fontSize: "11px",
                fontWeight: step.state === "current" ? 700 : 500,
                lineHeight: 1.3,
                color: step.state === "current" ? G.ink : step.state === "completed" ? G.inkSoft : G.inkFaint,
              }}>
                {step.label}
              </div>
              {step.state === "current" && (
                <div className="spt-mono" style={{ color: G.accent, marginTop: "6px" }}>Now</div>
              )}
              {step.state === "completed" && (
                <div className="spt-mono" style={{ color: G.green, marginTop: "6px" }}>Done</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
