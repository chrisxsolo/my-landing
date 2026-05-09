"use client";

import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  type AdminClientSessionDTO,
} from "@/lib/clientSessions";

type AdminSessionTableProps = {
  sessions: AdminClientSessionDTO[];
  onEdit: (session: AdminClientSessionDTO) => void;
};

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getLinkStatus(session: AdminClientSessionDTO) {
  return session.clientUserId ? "Google linked" : "Waiting for first login";
}

export default function AdminSessionTable({ sessions, onEdit }: AdminSessionTableProps) {
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
              </div>
              <h3 className="mt-1 text-lg font-black" style={{ color: C.ink }}>
                {session.clientName || "Unnamed client"}
              </h3>
              <p className="mt-1 break-all text-sm font-semibold" style={{ color: C.muted }}>
                {session.clientEmail}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onEdit(session)}
              className="min-h-10 w-full rounded-lg border px-4 text-sm font-black md:w-auto"
              style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
            >
              Edit
            </button>
          </div>

          <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Type</span>
              <div className="break-words font-semibold" style={{ color: C.muted }}>{session.sessionType || "Not set"}</div>
            </div>
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Date</span>
              <div className="font-semibold" style={{ color: C.muted }}>{formatDate(session.sessionDate)}</div>
            </div>
            <div className="min-w-0">
              <span className="font-black" style={{ color: C.ink }}>Location</span>
              <div className="break-words font-semibold" style={{ color: C.muted }}>{session.location || "Not set"}</div>
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
