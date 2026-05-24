"use client";

import { C } from "@/lib/colors";
import AdminSessionStatusStrip from "@/app/components/admin-session-status-strip";
import {
  CLIENT_SESSION_STATUS_LABELS,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type AdminSessionTableProps = {
  sessions: AdminClientSessionDTO[];
  onEdit: (session: AdminClientSessionDTO) => void;
  onUpdateStatus: (session: AdminClientSessionDTO, status: ClientSessionStatus) => void;
  statusSaving: { id: string; status: ClientSessionStatus } | null;
  gmailSyncing: string | null;
  onSyncFromGmail: (session: AdminClientSessionDTO) => void;
};

function formatDate(value: string | null) {
  if (!value) return "No date";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLinkStatus(session: AdminClientSessionDTO) {
  return session.clientUserId ? "Google linked" : "Waiting for first login";
}

export default function AdminSessionTable({
  sessions,
  onEdit,
  onUpdateStatus,
  statusSaving,
  gmailSyncing,
  onSyncFromGmail,
}: AdminSessionTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border p-6" style={{ background: C.surfaceSoft, borderColor: C.borderWarm }}>
        <h2 className="text-xl font-black" style={{ color: C.ink }}>No sessions found</h2>
        <p className="mt-2 text-sm font-semibold" style={{ color: C.muted }}>
          Create a session or adjust the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <article
          key={session.id}
          className="overflow-hidden rounded-xl border p-4"
          style={{ background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                  {CLIENT_SESSION_STATUS_LABELS[session.currentStatus]}
                </div>
                <span
                  className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                  style={{ background: session.clientUserId ? C.p1_08 : C.surfaceStrong, color: session.clientUserId ? C.p1 : C.muted }}
                >
                  {getLinkStatus(session)}
                </span>
                {session.googleLinkedAt && (
                  <span className="text-[10px] font-semibold" style={{ color: C.muted }}>
                    Signed in {formatDateTime(session.googleLinkedAt)}
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-lg font-black" style={{ color: C.ink }}>
                {session.clientName || "Unnamed client"}
              </h3>
              <p className="mt-1 break-all text-sm font-semibold" style={{ color: C.muted }}>
                {session.clientEmail}
              </p>
            </div>

            <div className="flex w-full gap-2 md:w-auto">
              <button
                type="button"
                onClick={() => onSyncFromGmail(session)}
                disabled={gmailSyncing === session.id}
                className="min-h-10 flex-1 rounded-lg border px-3 text-sm font-black md:flex-none"
                style={{ background: C.p1_08, borderColor: C.p1_20, color: C.p1, opacity: gmailSyncing === session.id ? 0.6 : 1 }}
              >
                {gmailSyncing === session.id ? "Syncing…" : "Sync Gmail"}
              </button>
              <button
                type="button"
                onClick={() => onEdit(session)}
                className="min-h-10 flex-1 rounded-lg border px-4 text-sm font-black md:flex-none"
                style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
              >
                Edit
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border p-3" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                  Portal progress
                </div>
                <p className="mt-1 text-xs font-semibold" style={{ color: C.muted }}>
                  Click any stage and the client dashboard updates to match.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <AdminSessionStatusStrip
                currentStatus={session.currentStatus}
                savingStatus={statusSaving?.id === session.id ? statusSaving.status : null}
                onSelect={(status) => onUpdateStatus(session, status)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Type</span>
              <div className="break-words font-semibold" style={{ color: C.muted }}>{session.sessionType || "Not set"}</div>
            </div>
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Date &amp; Time</span>
              <div className="font-semibold" style={{ color: C.muted }}>
                {formatDate(session.sessionDate)}
                {session.sessionDate && formatDateTime(session.sessionDate) !== formatDate(session.sessionDate) && (
                  <span className="ml-1 text-[11px]" style={{ color: C.p1 }}>
                    {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(session.sessionDate))}
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Location</span>
              <div className="break-words font-semibold" style={{ color: C.muted }}>{session.location || "Not set"}</div>
              {session.meetingPoint && (
                <div className="mt-0.5 break-words text-xs font-semibold" style={{ color: C.p1 }}>{session.meetingPoint}</div>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Delivery</span>
              <div className="break-words font-semibold" style={{ color: C.muted }}>{session.estimatedDeliveryDate || "Not set"}</div>
            </div>
          </div>

          {session.internalNotes && (
            <p className="mt-3 break-words rounded-lg border p-3 text-xs font-semibold leading-5" style={{ background: C.p1_04, borderColor: C.borderSubtle, color: C.inkSoft }}>
              {session.internalNotes}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
