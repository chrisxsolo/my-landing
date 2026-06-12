import Link from "next/link";
import {
  CLIENT_SESSION_TIME_ZONE,
  CLIENT_SESSION_STATUS_LABELS,
  formatClientSessionDateTime,
  getClientSessionProgress,
  type ClientSessionDTO,
} from "@/lib/clientSessions";
import { G } from "@/lib/portalTheme";
import PortalStyleTag from "@/app/components/portal-style-tag";
import SessionProgressTracker from "@/app/components/session-progress-tracker";

type SessionCardProps = {
  session: ClientSessionDTO;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLIENT_SESSION_TIME_ZONE,
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
  return "This page updates live as your gallery moves through backup, culling, editing, and delivery.";
}

export default function SessionCard({ session }: SessionCardProps) {
  const statusLabel = CLIENT_SESSION_STATUS_LABELS[session.currentStatus];
  const steps = getClientSessionProgress(session.currentStatus);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const nextStep = steps[currentIndex + 1]?.label ?? "Gallery delivered";
  const delivered = session.currentStatus === "delivered";

  const details = [
    { label: "Date", value: formatClientSessionDateTime(session.sessionDate) },
    { label: "Location", value: session.location },
    { label: "Meeting point", value: session.meetingPoint },
    { label: "Est. delivery", value: formatDate(session.estimatedDeliveryDate) },
    { label: "Invoice", value: session.invoiceStatus },
    { label: "Contract", value: session.contractStatus },
  ];

  return (
    <article className="gp-panel" style={{ overflow: "hidden" }}>
      <PortalStyleTag />
      <div style={{ padding: "24px 26px 28px" }}>

        {/* Status row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="gp-chip" data-done={delivered}>{statusLabel}</span>
            <span className="gp-mono">Step {currentIndex + 1} of {steps.length}</span>
            {!delivered && <span className="gp-mono">Next: {nextStep}</span>}
          </div>

          {session.galleryUrl && (
            <Link
              href={session.galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gp-btn"
            >
              View gallery
            </Link>
          )}
        </div>

        <p style={{
          marginTop: "12px",
          fontSize: "13px",
          lineHeight: 1.7,
          color: G.inkSoft,
          maxWidth: "520px",
        }}>
          {getSessionIntro(session)}
        </p>

        {/* Progress */}
        <div className="gp-rule" style={{ margin: "22px 0 18px" }} />
        <div className="gp-mono" style={{ marginBottom: "14px" }}>Inquiry to delivery</div>
        <SessionProgressTracker status={session.currentStatus} />

        {/* Details */}
        <div className="gp-rule" style={{ margin: "22px 0 18px" }} />
        <div className="grid gap-2 sm:grid-cols-3">
          {details.map(({ label, value }) => (
            <div key={label} className="gp-tile">
              <div className="gp-mono" style={{ marginBottom: "5px" }}>{label}</div>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: value && value !== "—" ? G.inkSoft : G.inkFaint,
                overflowWrap: "break-word",
              }}>
                {value || "—"}
              </div>
            </div>
          ))}
        </div>

        {session.clientNotes && (
          <div style={{
            marginTop: "14px",
            background: G.accentBg,
            border: `1px solid ${G.accentBorder}`,
            borderRadius: "10px",
            padding: "16px 18px",
          }}>
            <div className="gp-mono" style={{ color: G.accent, marginBottom: "7px" }}>
              Note from Chris
            </div>
            <p style={{ fontSize: "13px", lineHeight: 1.7, color: G.inkSoft, margin: 0 }}>
              {session.clientNotes}
            </p>
          </div>
        )}

      </div>
    </article>
  );
}
