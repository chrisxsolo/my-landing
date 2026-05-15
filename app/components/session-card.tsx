import Link from "next/link";
import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  getClientSessionProgress,
  type ClientSessionDTO,
} from "@/lib/clientSessions";
import SessionProgressTracker from "@/app/components/session-progress-tracker";

type SessionCardProps = {
  session: ClientSessionDTO;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function getSessionIntro(session: ClientSessionDTO) {
  if (session.currentStatus === "delivered") {
    return "Your gallery is ready — use the button below to view your photos.";
  }
  if (session.currentStatus === "inquiry_received") {
    return "Inquiry received. This tracker will move with you from booking through delivery.";
  }
  if (session.currentStatus === "booking_in_progress") {
    return "Getting the details locked in. Once your date, contract, and invoice are confirmed, you'll move into booked.";
  }
  return "Here's the current progress for your photo session. This updates as your gallery moves through backup, culling, editing, and delivery.";
}

const CARD_STYLES = `
  .sc-shell {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 18px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06);
  }

  .sc-shell::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(0,0,0,0.09) 30%,
      rgba(0,0,0,0.14) 50%,
      rgba(0,0,0,0.09) 70%,
      transparent 100%
    );
    pointer-events: none;
  }

  .sc-inner {
    position: relative;
    z-index: 1;
    padding: 28px 32px 32px;
  }

  .sc-mono {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .sc-detail {
    background: rgba(0,0,0,0.025);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 12px;
    padding: 14px 16px;
    transition: border-color 180ms ease, background 180ms ease;
  }
  .sc-detail:hover {
    border-color: rgba(0,0,0,0.12);
    background: rgba(0,0,0,0.04);
  }

  .sc-rule {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,0.07) 20%, rgba(0,0,0,0.07) 80%, transparent);
    margin: 24px 0;
  }

  .sc-gallery-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding: 0 20px;
    border-radius: 8px;
    background: #111110;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    letter-spacing: 0.01em;
    transition: background 160ms ease, transform 160ms ease;
    flex-shrink: 0;
  }
  .sc-gallery-btn:hover {
    background: #1e1d1b;
    transform: translateY(-1px);
  }
  .sc-gallery-btn:active {
    transform: translateY(0);
  }

  .sc-status-chip {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid rgba(0,0,0,0.10);
    background: rgba(0,0,0,0.04);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(0,0,0,0.48);
  }

  @media (prefers-reduced-motion: reduce) {
    .sc-gallery-btn:hover { transform: none; }
    .sc-detail { transition: none; }
  }
`;

export default function SessionCard({ session }: SessionCardProps) {
  const statusLabel = CLIENT_SESSION_STATUS_LABELS[session.currentStatus];
  const steps = getClientSessionProgress(session.currentStatus);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const nextStep = steps[currentIndex + 1]?.label ?? "Gallery delivered";

  return (
    <article className="sc-shell">
      <style>{CARD_STYLES}</style>
      <div className="sc-inner">

        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="sc-status-chip">{statusLabel}</span>
              <span className="sc-mono" style={{ color: "rgba(0,0,0,0.50)" }}>
                Step {currentIndex + 1} of {steps.length}
              </span>
              <span className="sc-mono" style={{ color: "rgba(0,0,0,0.45)" }}>
                Next: {nextStep}
              </span>
            </div>

            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
              fontWeight: 400,
              lineHeight: 1.08,
              color: "rgba(0,0,0,0.84)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}>
              {session.clientName || "Your photo session"}
            </h2>

            <p style={{
              marginTop: "10px",
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: 1.7,
              color: "rgba(0,0,0,0.62)",
              maxWidth: "480px",
            }}>
              {getSessionIntro(session)}
            </p>
          </div>

          {session.galleryUrl && (
            <Link
              href={session.galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sc-gallery-btn"
            >
              View gallery
            </Link>
          )}
        </div>

        {/* Quick detail row */}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Type", value: session.sessionType },
            { label: "Date", value: formatDateTime(session.sessionDate) },
            { label: "Location", value: session.location },
          ].map(({ label, value }) => (
            <div key={label} className="sc-detail">
              <div className="sc-mono" style={{ color: "rgba(0,0,0,0.50)", marginBottom: "6px" }}>
                {label}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(0,0,0,0.65)" }}>
                {value || "—"}
              </div>
            </div>
          ))}
        </div>

        <div className="sc-rule" />

        {/* Progress tracker */}
        <div>
          <div className="sc-mono" style={{ color: "rgba(0,0,0,0.50)", marginBottom: "16px" }}>
            Inquiry to delivery
          </div>
          <SessionProgressTracker status={session.currentStatus} />
        </div>

        {/* Detail grid */}
        <div className="sc-rule" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Meeting point", value: session.meetingPoint },
            { label: "Est. delivery", value: formatDate(session.estimatedDeliveryDate) },
            { label: "Invoice", value: session.invoiceStatus },
            { label: "Contract", value: session.contractStatus },
          ].map(({ label, value }) => (
            <div key={label} className="sc-detail">
              <div className="sc-mono" style={{ color: "rgba(0,0,0,0.50)", marginBottom: "6px" }}>
                {label}
              </div>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: value ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.38)",
              }}>
                {value || "—"}
              </div>
            </div>
          ))}
        </div>

        {session.clientNotes && (
          <div style={{
            marginTop: "16px",
            background: "rgba(0,0,0,0.025)",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: "12px",
            padding: "18px 20px",
          }}>
            <div className="sc-mono" style={{ color: "rgba(0,0,0,0.50)", marginBottom: "8px" }}>
              Note from Chris
            </div>
            <p style={{
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: 1.7,
              color: "rgba(0,0,0,0.68)",
              margin: 0,
            }}>
              {session.clientNotes}
            </p>
          </div>
        )}

      </div>
    </article>
  );
}
