"use client";

import { type ReactNode, useState } from "react";
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
  onPreview: (email: string) => void;
  onUpdateStatus: (session: AdminClientSessionDTO, status: ClientSessionStatus) => void;
  statusSaving: { id: string; status: ClientSessionStatus } | null;
  gmailSyncing: string | null;
  onSyncFromGmail: (session: AdminClientSessionDTO) => void;
  onDelete: (session: AdminClientSessionDTO) => void;
  onUnlinkAccount: (session: AdminClientSessionDTO) => void;
  onUpdateInvoice: (session: AdminClientSessionDTO, status: string | null) => void;
  onUpdateContract: (session: AdminClientSessionDTO, status: string | null) => void;
  onUpdateField: (session: AdminClientSessionDTO, fields: Record<string, unknown>) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  deletingId?: string | null;
  unlinkingId?: string | null;
};

const INVOICE_CYCLE: Array<string | null> = [null, "sent", "paid"];
const CONTRACT_CYCLE: Array<string | null> = [null, "sent", "signed"];

function nextInCycle(cycle: Array<string | null>, current: string | null): string | null {
  const normalized = current?.trim().toLowerCase() || null;
  const idx = cycle.indexOf(normalized);
  return cycle[(idx + 1) % cycle.length];
}

function invoiceLabel(status: string | null) {
  const s = status?.trim().toLowerCase() || null;
  if (s === "paid") return { label: "Invoice Paid", bg: "rgba(16,185,129,0.12)", color: "#059669" };
  if (s === "sent") return { label: "Invoice Sent", bg: "rgba(245,158,11,0.12)", color: "#d97706" };
  return { label: "No Invoice", bg: "rgba(0,0,0,0.05)", color: "#94a3b8" };
}

function contractLabel(status: string | null) {
  const s = status?.trim().toLowerCase() || null;
  if (s === "signed") return { label: "Contract Signed", bg: "rgba(16,185,129,0.12)", color: "#059669" };
  if (s === "sent")   return { label: "Contract Sent",   bg: "rgba(245,158,11,0.12)", color: "#d97706" };
  return { label: "No Contract", bg: "rgba(0,0,0,0.05)", color: "#94a3b8" };
}

function toDatetimeLocalString(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : new Date(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function getLinkStatus(session: AdminClientSessionDTO) {
  return session.clientUserId ? "Google linked" : "Waiting for first login";
}

export default function AdminSessionTable({
  sessions,
  onEdit,
  onPreview,
  onUpdateStatus,
  statusSaving,
  gmailSyncing,
  onSyncFromGmail,
  onDelete,
  onUnlinkAccount,
  onUpdateInvoice,
  onUpdateContract,
  onUpdateField,
  onMoveUp,
  onMoveDown,
  deletingId,
  unlinkingId,
}: AdminSessionTableProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ sessionId: string; field: string; value: string } | null>(null);

  function commitEdit(session: AdminClientSessionDTO) {
    if (!inlineEdit) return;
    onUpdateField(session, { [inlineEdit.field]: inlineEdit.value.trim() || null });
    setInlineEdit(null);
  }

  function renderInlineField(
    session: AdminClientSessionDTO,
    field: string,
    currentValue: string | null,
    display: ReactNode,
    inputType: string,
  ) {
    const isEditing = inlineEdit?.sessionId === session.id && inlineEdit.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          type={inputType}
          value={inlineEdit.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
          onBlur={() => commitEdit(session)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(session);
            if (e.key === "Escape") setInlineEdit(null);
          }}
          className="w-full rounded border px-1 py-0.5 text-sm font-semibold outline-none"
          style={{ borderColor: C.p1_20, color: C.inkSoft, background: C.surfaceStrong }}
        />
      );
    }
    return (
      <div
        className="cursor-pointer rounded font-semibold transition-colors hover:bg-black/5"
        style={{ color: currentValue ? C.muted : "#94a3b8" }}
        onClick={() => setInlineEdit({ sessionId: session.id, field, value: currentValue ?? "" })}
        title="Click to edit"
      >
        {display}
      </div>
    );
  }

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
      {sessions.map((session, index) => {
        const inv = invoiceLabel(session.invoiceStatus);
        const con = contractLabel(session.contractStatus);
        const isDeleteConfirming = deleteConfirmId === session.id;
        const isDeleting = deletingId === session.id;
        const isUnlinking = unlinkingId === session.id;
        const isFirst = index === 0;
        const isLast = index === sessions.length - 1;

        return (
          <article
            key={session.id}
            className="overflow-hidden rounded-xl border p-4"
            style={{ background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
          >
            {/* Top row: status label + reorder + action buttons */}
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

              <div className="flex flex-wrap gap-2 md:flex-nowrap">
                {/* Reorder arrows */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveUp(session.id)}
                    disabled={isFirst}
                    title="Move up"
                    className="min-h-10 w-10 rounded-lg border text-base font-black disabled:opacity-25"
                    style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown(session.id)}
                    disabled={isLast}
                    title="Move down"
                    className="min-h-10 w-10 rounded-lg border text-base font-black disabled:opacity-25"
                    style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
                  >
                    ↓
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onSyncFromGmail(session)}
                  disabled={gmailSyncing === session.id}
                  className="min-h-10 rounded-lg border px-3 text-sm font-black"
                  style={{ background: C.p1_08, borderColor: C.p1_20, color: C.p1, opacity: gmailSyncing === session.id ? 0.6 : 1 }}
                >
                  {gmailSyncing === session.id ? "Syncing…" : "Sync Gmail"}
                </button>
                <button
                  type="button"
                  onClick={() => onPreview(session.clientEmail)}
                  className="min-h-10 rounded-lg border px-3 text-sm font-black"
                  style={{ background: "#f0f9ff", borderColor: "#bae6fd", color: "#0369a1" }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(session)}
                  className="min-h-10 rounded-lg border px-4 text-sm font-black"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Invoice + Contract quick-toggle pills */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdateInvoice(session, nextInCycle(INVOICE_CYCLE, session.invoiceStatus))}
                className="rounded-full px-3 py-1 text-[11px] font-black transition-opacity hover:opacity-75"
                style={{ background: inv.bg, color: inv.color }}
                title="Click to advance invoice status"
              >
                {inv.label} →
              </button>
              <button
                type="button"
                onClick={() => onUpdateContract(session, nextInCycle(CONTRACT_CYCLE, session.contractStatus))}
                className="rounded-full px-3 py-1 text-[11px] font-black transition-opacity hover:opacity-75"
                style={{ background: con.bg, color: con.color }}
                title="Click to advance contract status"
              >
                {con.label} →
              </button>
            </div>

            {/* Progress strip */}
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

            {/* Session details — click any value to edit inline */}
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
              <div className="min-w-0">
                <span className="font-black" style={{ color: C.ink }}>Type</span>
                {renderInlineField(
                  session,
                  "sessionType",
                  session.sessionType,
                  <span className="break-words">{session.sessionType || "Not set"}</span>,
                  "text",
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: C.ink }}>Date &amp; Time</span>
                {renderInlineField(
                  session,
                  "sessionDate",
                  toDatetimeLocalString(session.sessionDate),
                  <>
                    {formatDate(session.sessionDate)}
                    {session.sessionDate && formatDateTime(session.sessionDate) !== formatDate(session.sessionDate) && (
                      <span className="ml-1 text-[11px]" style={{ color: C.p1 }}>
                        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(session.sessionDate))}
                      </span>
                    )}
                  </>,
                  "datetime-local",
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: C.ink }}>Location</span>
                {renderInlineField(
                  session,
                  "location",
                  session.location,
                  <span className="break-words">{session.location || "Not set"}</span>,
                  "text",
                )}
                {session.meetingPoint && !(inlineEdit?.sessionId === session.id && inlineEdit.field === "location") && (
                  <div className="mt-0.5 break-words text-xs font-semibold" style={{ color: C.p1 }}>{session.meetingPoint}</div>
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: C.ink }}>Delivery</span>
                {renderInlineField(
                  session,
                  "estimatedDeliveryDate",
                  session.estimatedDeliveryDate,
                  <span className="break-words">{session.estimatedDeliveryDate || "Not set"}</span>,
                  "date",
                )}
              </div>
            </div>

            {session.internalNotes && (
              <p className="mt-3 break-words rounded-lg border p-3 text-xs font-semibold leading-5" style={{ background: C.p1_04, borderColor: C.borderSubtle, color: C.inkSoft }}>
                {session.internalNotes}
              </p>
            )}

            {/* Bottom actions: unlink account + delete */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: C.borderSubtle }}>
              {session.clientUserId && (
                <button
                  type="button"
                  onClick={() => onUnlinkAccount(session)}
                  disabled={isUnlinking}
                  className="rounded-lg border px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-75 disabled:opacity-50"
                  style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)", color: "#d97706" }}
                >
                  {isUnlinking ? "Unlinking…" : "Unlink Google account"}
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                {isDeleteConfirming ? (
                  <>
                    <span className="text-xs font-bold" style={{ color: C.muted }}>Delete this session?</span>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirmId(null); onDelete(session); }}
                      disabled={isDeleting}
                      className="rounded-lg border px-3 py-1.5 text-xs font-black disabled:opacity-50"
                      style={{ background: "rgba(220,38,38,0.1)", borderColor: "rgba(220,38,38,0.25)", color: "#dc2626" }}
                    >
                      {isDeleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.muted }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(session.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-75"
                    style={{ background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.2)", color: "#dc2626" }}
                  >
                    Delete session
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
