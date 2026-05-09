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

function CompactDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold" style={{ color: value ? C.ink : C.muted }}>
        {value || "Not set yet"}
      </div>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.13em]"
      style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
    >
      {label}
    </span>
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
  const steps = getClientSessionProgress(session.currentStatus);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const nextStep = steps[currentIndex + 1]?.label ?? "Gallery delivered";

  return (
    <article
      className="session-card-shell relative overflow-hidden rounded-[2rem] border p-5 shadow-sm md:p-7"
      style={{ background: "rgba(255,251,247,0.84)", borderColor: C.borderWarm, boxShadow: C.shadowWarm }}
    >
      <style>{`
        .session-card-shell::before {
          background: linear-gradient(90deg, ${C.p1}, ${C.p2}, ${C.p3}, transparent 88%);
          content: "";
          height: 6px;
          inset: 0 0 auto 0;
          position: absolute;
        }

        .session-card-shell::after {
          background:
            radial-gradient(circle at 16% 0%, ${C.p1_12}, transparent 34%),
            radial-gradient(circle at 88% 18%, ${C.p3_15}, transparent 30%),
            linear-gradient(135deg, transparent 56%, ${C.white_22});
          content: "";
          inset: 0;
          pointer-events: none;
          position: absolute;
        }

        .session-card-content {
          position: relative;
          z-index: 1;
        }

        .session-shell-panel {
          backdrop-filter: blur(18px);
          position: relative;
        }

        .session-shell-panel::before {
          background: linear-gradient(135deg, ${C.white_82}, transparent 42%);
          border-radius: inherit;
          content: "";
          inset: 1px;
          pointer-events: none;
          position: absolute;
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
        <div className="session-shell-panel rounded-[1.65rem] border p-4 md:p-5" style={{ background: "rgba(255,255,255,0.56)", borderColor: C.borderSubtle }}>
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em]"
                    style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.p1 }}
                  >
                    {statusLabel}
                  </div>
                  <MetaChip label={`Step ${currentIndex + 1} of ${steps.length}`} />
                  <MetaChip label={`Next: ${nextStep}`} />
                </div>
                <h2 className="mt-3 text-2xl font-black leading-[0.95] tracking-tight md:text-4xl" style={{ color: C.ink }}>
                  {session.clientName || "Your photo session"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 md:text-[15px]" style={{ color: C.inkSoft }}>
                  {getSessionIntro(session)}
                </p>
              </div>

              {session.galleryUrl && (
                <Link
                  href={session.galleryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="session-gallery-action inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-black md:w-auto"
                  style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
                >
                  View gallery
                </Link>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.2rem] border px-4 py-3" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                  Session type
                </p>
                <p className="mt-2 text-sm font-bold leading-5" style={{ color: C.ink }}>
                  {session.sessionType || "Not set yet"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border px-4 py-3" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                  Session date
                </p>
                <p className="mt-2 text-sm font-bold leading-5" style={{ color: C.ink }}>
                  {formatDateTime(session.sessionDate)}
                </p>
              </div>
              <div className="rounded-[1.2rem] border px-4 py-3" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                  Location
                </p>
                <p className="mt-2 text-sm font-bold leading-5" style={{ color: C.ink }}>
                  {session.location || "Not set yet"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.mutedSoft }}>
            Inquiry to delivery progress
          </div>
          <SessionProgressTracker status={session.currentStatus} />
        </div>

        <div className="mt-6 grid gap-3 md:hidden">
          <div className="grid grid-cols-2 gap-3">
            <CompactDetail label="Delivery" value={formatDate(session.estimatedDeliveryDate)} />
            <CompactDetail label="Meeting point" value={session.meetingPoint} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CompactDetail label="Invoice" value={session.invoiceStatus} />
            <CompactDetail label="Contract" value={session.contractStatus} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: session.backupStatus ? C.inkSoft : C.muted }}>
              Backup: {session.backupStatus || "Not set"}
            </span>
            {session.galleryUrl && (
              <span className="rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]" style={{ background: C.p1_08, borderColor: C.borderSubtle, color: C.p1 }}>
                Gallery ready
              </span>
            )}
          </div>
        </div>

        <div className="mt-7 hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
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
