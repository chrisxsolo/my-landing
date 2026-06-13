"use client";

import { type ReactNode, useState } from "react";
import { T } from "@/app/admin/adminTheme";
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
  if (s === "paid") return { label: "Invoice Paid", bg: T.greenBg, color: T.green };
  if (s === "sent") return { label: "Invoice Sent", bg: T.amberBg, color: T.amber };
  return { label: "No Invoice", bg: T.neutralBg, color: T.inkFaint };
}

function contractLabel(status: string | null) {
  const s = status?.trim().toLowerCase() || null;
  if (s === "signed") return { label: "Contract Signed", bg: T.greenBg, color: T.green };
  if (s === "sent")   return { label: "Contract Sent",   bg: T.amberBg, color: T.amber };
  return { label: "No Contract", bg: T.neutralBg, color: T.inkFaint };
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
          style={{ borderColor: T.amberBorder, color: T.ink, background: T.inset }}
        />
      );
    }
    return (
      <div
        className="cursor-pointer rounded font-semibold transition-colors hover:bg-white/5"
        style={{ color: currentValue ? T.inkSoft : T.inkFaint }}
        onClick={() => setInlineEdit({ sessionId: session.id, field, value: currentValue ?? "" })}
        title="Click to edit"
      >
        {display}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border p-6" style={{ background: T.panel, borderColor: T.border }}>
        <h2 className="text-xl" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>No sessions found</h2>
        <p className="mt-2 text-sm font-semibold" style={{ color: T.inkFaint }}>
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
            style={{ background: T.panel, borderColor: T.border, boxShadow: T.shadow }}
          >
            {/* Top row: status label + reorder + action buttons */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.action, fontFamily: T.mono }}>
                    {CLIENT_SESSION_STATUS_LABELS[session.currentStatus]}
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                    style={{
                      background: session.clientUserId ? T.greenBg : T.neutralBg,
                      color: session.clientUserId ? T.green : T.inkFaint,
                    }}
                  >
                    {getLinkStatus(session)}
                  </span>
                  {session.googleLinkedAt && (
                    <span className="text-[10px] font-semibold" style={{ color: T.inkFaint }}>
                      Signed in {formatDateTime(session.googleLinkedAt)}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-lg" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>
                  {session.clientName || "Unnamed client"}
                </h3>
                <p className="mt-1 break-all text-sm font-semibold" style={{ color: T.inkFaint, fontFamily: T.mono, fontSize: "12px" }}>
                  {session.clientEmail}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:flex-nowrap">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveUp(session.id)}
                    disabled={isFirst}
                    title="Move up"
                    className="min-h-10 w-10 rounded-lg border text-base font-black disabled:opacity-25"
                    style={{ background: T.inset, borderColor: T.border, color: T.inkSoft }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown(session.id)}
                    disabled={isLast}
                    title="Move down"
                    className="min-h-10 w-10 rounded-lg border text-base font-black disabled:opacity-25"
                    style={{ background: T.inset, borderColor: T.border, color: T.inkSoft }}
                  >
                    ↓
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onSyncFromGmail(session)}
                  disabled={gmailSyncing === session.id}
                  className="min-h-10 rounded-lg border px-3 text-sm font-black"
                  style={{ background: T.amberBg, borderColor: T.amberBorder, color: T.amber, opacity: gmailSyncing === session.id ? 0.6 : 1 }}
                >
                  {gmailSyncing === session.id ? "Syncing…" : "Sync Gmail"}
                </button>
                <button
                  type="button"
                  onClick={() => onPreview(session.clientEmail)}
                  className="min-h-10 rounded-lg border px-3 text-sm font-black"
                  style={{ background: T.blueBg, borderColor: T.blueBorder, color: T.blue }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(session)}
                  className="min-h-10 rounded-lg border px-4 text-sm font-black"
                  style={{ background: T.inset, borderColor: T.borderStrong, color: T.ink }}
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
            <div className="mt-4 rounded-xl border p-3" style={{ background: T.inset, borderColor: T.rowBorder }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.action, fontFamily: T.mono }}>
                Portal progress
              </div>
              <p className="mt-1 text-xs font-semibold" style={{ color: T.inkFaint }}>
                Click any stage and the client dashboard updates to match.
              </p>
              <div className="mt-3">
                <AdminSessionStatusStrip
                  appearance="dark"
                  currentStatus={session.currentStatus}
                  savingStatus={statusSaving?.id === session.id ? statusSaving.status : null}
                  onSelect={(status) => onUpdateStatus(session, status)}
                />
              </div>
            </div>

            {/* Session details — click any value to edit inline */}
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Type</span>
                {renderInlineField(
                  session,
                  "sessionType",
                  session.sessionType,
                  <span className="break-words">{session.sessionType || "Not set"}</span>,
                  "text",
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Date &amp; Time</span>
                {renderInlineField(
                  session,
                  "sessionDate",
                  toDatetimeLocalString(session.sessionDate),
                  <>
                    {formatDate(session.sessionDate)}
                    {session.sessionDate && formatDateTime(session.sessionDate) !== formatDate(session.sessionDate) && (
                      <span className="ml-1 text-[11px]" style={{ color: T.amber }}>
                        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(session.sessionDate))}
                      </span>
                    )}
                  </>,
                  "datetime-local",
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Location</span>
                {renderInlineField(
                  session,
                  "location",
                  session.location,
                  <span className="break-words">{session.location || "Not set"}</span>,
                  "text",
                )}
                {session.meetingPoint && !(inlineEdit?.sessionId === session.id && inlineEdit.field === "location") && (
                  <div className="mt-0.5 break-words text-xs font-semibold" style={{ color: T.amber }}>{session.meetingPoint}</div>
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Delivery</span>
                {renderInlineField(
                  session,
                  "estimatedDeliveryDate",
                  session.estimatedDeliveryDate,
                  <span className="break-words" style={{ color: session.estimatedDeliveryDate ? T.inkSoft : T.inkFaint }}>
                    {session.estimatedDeliveryDate ? formatDate(session.estimatedDeliveryDate) : "Not set"}
                  </span>,
                  "date",
                )}
              </div>
            </div>

            {session.internalNotes && (
              <p className="mt-3 break-words rounded-lg border p-3 text-xs font-semibold leading-5" style={{ background: T.violetBg, borderColor: T.violetBorder, color: T.inkSoft }}>
                {session.internalNotes}
              </p>
            )}

            {/* Bottom actions: unlink account + delete */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: T.rowBorder }}>
              {session.clientUserId && (
                <button
                  type="button"
                  onClick={() => onUnlinkAccount(session)}
                  disabled={isUnlinking}
                  className="rounded-lg border px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-75 disabled:opacity-50"
                  style={{ background: T.amberBg, borderColor: T.amberBorder, color: T.amber }}
                >
                  {isUnlinking ? "Unlinking…" : "Unlink Google account"}
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                {isDeleteConfirming ? (
                  <>
                    <span className="text-xs font-bold" style={{ color: T.inkFaint }}>Delete this session?</span>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirmId(null); onDelete(session); }}
                      disabled={isDeleting}
                      className="rounded-lg border px-3 py-1.5 text-xs font-black disabled:opacity-50"
                      style={{ background: T.redBg, borderColor: T.redBorder, color: T.red }}
                    >
                      {isDeleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      style={{ background: T.inset, borderColor: T.border, color: T.inkFaint }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(session.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-75"
                    style={{ background: T.redBg, borderColor: T.redBorder, color: T.red }}
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
