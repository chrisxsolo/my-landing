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
    <div className="rounded-lg border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>
        {value || "Not set yet"}
      </div>
    </div>
  );
}

export default function SessionCard({ session }: SessionCardProps) {
  const delivered = session.currentStatus === "delivered";

  return (
    <article
      className="rounded-xl border p-5 shadow-sm md:p-7"
      style={{ background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
            {CLIENT_SESSION_STATUS_LABELS[session.currentStatus]}
          </div>
          <h2 className="mt-2 text-2xl font-black leading-tight md:text-3xl" style={{ color: C.ink }}>
            {session.clientName || "Your photo session"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6" style={{ color: C.muted }}>
            {delivered
              ? "Your gallery is ready! You can view your photos using the button below."
              : "Here's the current progress for your photo session. I'll update this as your gallery moves through backup, culling, editing, final review, and delivery."}
          </p>
        </div>

        {session.galleryUrl && (
          <Link
            href={session.galleryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-black"
            style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
          >
            View gallery
          </Link>
        )}
      </div>

      <div className="mt-7">
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
        <div className="mt-5 rounded-lg border p-4" style={{ background: C.surfaceWarmAlt, borderColor: C.borderWarm }}>
          <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
            Note from Chris
          </div>
          <p className="mt-2 text-sm font-semibold leading-6" style={{ color: C.inkSoft }}>
            {session.clientNotes}
          </p>
        </div>
      )}
    </article>
  );
}
