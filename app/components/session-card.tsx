import Link from "next/link";
import { C } from "@/lib/colors";
import { CLIENT_SESSION_STATUS_LABELS, type ClientSessionDTO } from "@/lib/clientSessions";
import SessionProgressTracker from "@/app/components/session-progress-tracker";

type SessionCardProps = {
  session: ClientSessionDTO;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "Not set yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="session-detail-card rounded-2xl border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>
        {value || "Not set yet"}
      </div>
    </div>
  );
}

function getSessionIntro(session: ClientSessionDTO) {
  if (session.currentStatus === "delivered") {
    return "Your gallery is ready! You can view your photos using the button below.";
  }

  if (session.currentStatus === "inquiry_received") {
    return "I received your inquiry. This tracker will move with you from booking details to session day, editing, final review, and delivery.";
  }

  if (session.currentStatus === "booking_in_progress") {
    return "We are getting the details locked in. Once your date, contract, and invoice are confirmed, your session will move into booked.";
  }

  return "Here's the current progress for your photo session. I'll update this as your gallery moves through backup, culling, editing, final review, and delivery.";
}

export default function SessionCard({ session }: SessionCardProps) {
  const statusLabel = CLIENT_SESSION_STATUS_LABELS[session.currentStatus];

  return (
    <article
      className="session-card-shell relative overflow-hidden rounded-[2rem] border p-5 shadow-sm md:p-7"
      style={{ background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
    >
      <style>{`
        .session-card-shell::before {
          background: ${C.grad90};
          content: "";
          height: 5px;
          inset: 0 0 auto 0;
          position: absolute;
        }

        .session-card-shell::after {
          background: radial-gradient(circle at 20% 0%, ${C.p1_12}, transparent 34%), radial-gradient(circle at 86% 18%, ${C.p3_15}, transparent 30%);
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
        }

        .session-card-content {
          position: relative;
          z-index: 1;
        }

        .session-detail-card {
          transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
        }

        .session-detail-card:hover {
          border-color: ${C.p1_25};
          box-shadow: ${C.shadowWarmSm};
          transform: translateY(-2px);
        }

        .session-gallery-action {
          transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
        }

        .session-gallery-action:hover {
          opacity: .94;
          transform: translateY(-2px);
        }

        @media (prefers-reduced-motion: reduce) {
          .session-detail-card,
          .session-gallery-action {
            transition: none;
          }

          .session-detail-card:hover,
          .session-gallery-action:hover {
            transform: none;
          }
        }
      `}</style>

      <div className="session-card-content">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div
            className="inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em]"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.p1 }}
          >
            {statusLabel}
          </div>
          <h2 className="mt-2 text-2xl font-black leading-tight md:text-3xl" style={{ color: C.ink }}>
            {session.clientName || "Your photo session"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6" style={{ color: C.muted }}>
            {getSessionIntro(session)}
          </p>
        </div>

        {session.galleryUrl && (
          <Link
            href={session.galleryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="session-gallery-action inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black"
            style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
          >
            View gallery
          </Link>
        )}
      </div>

      <div className="mt-7">
        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.mutedSoft }}>
          Inquiry to delivery progress
        </div>
        <SessionProgressTracker status={session.currentStatus} />
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Session type" value={session.sessionType} />
        <DetailItem label="Session date" value={formatDateTime(session.sessionDate)} />
        <DetailItem label="Location" value={session.location} />
        <DetailItem label="Meeting point" value={session.meetingPoint} />
        <DetailItem label="Estimated delivery" value={formatDate(session.estimatedDeliveryDate)} />
        <DetailItem label="Invoice status" value={session.invoiceStatus} />
        <DetailItem label="Contract status" value={session.contractStatus} />
        <DetailItem label="Backup status" value={session.backupStatus} />
      </div>

      {session.clientNotes && (
        <div className="mt-5 rounded-2xl border p-5" style={{ background: C.surfaceWarmAlt, borderColor: C.borderWarm }}>
          <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
            Note from Chris
          </div>
          <p className="mt-2 text-sm font-semibold leading-6" style={{ color: C.inkSoft }}>
            {session.clientNotes}
          </p>
        </div>
      )}
      </div>
    </article>
  );
}
