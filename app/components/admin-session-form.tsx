"use client";

import { useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import type { ClientSessionContactOption } from "@/lib/clientSessionContacts";

export type AdminSessionFormPayload = {
  clientEmail: string;
  clientName: string;
  sessionType: string;
  sessionDate: string;
  location: string;
  meetingPoint: string;
  currentStatus: ClientSessionStatus;
  estimatedDeliveryDate: string;
  galleryUrl: string;
  invoiceStatus: string;
  contractStatus: string;
  backupStatus: string;
  internalNotes: string;
  clientNotes: string;
};

type AdminSessionFormProps = {
  initialSession?: AdminClientSessionDTO | null;
  contacts: ClientSessionContactOption[];
  saving: boolean;
  onSubmit: (payload: AdminSessionFormPayload) => Promise<void>;
};

const BLANK_FORM: AdminSessionFormPayload = {
  clientEmail: "",
  clientName: "",
  sessionType: "",
  sessionDate: "",
  location: "",
  meetingPoint: "",
  currentStatus: "inquiry_received",
  estimatedDeliveryDate: "",
  galleryUrl: "",
  invoiceStatus: "",
  contractStatus: "",
  backupStatus: "",
  internalNotes: "",
  clientNotes: "",
};

const INVOICE_OPTS = ["Not Sent", "Sent", "Paid", "Overdue"];
const CONTRACT_OPTS = ["Not Sent", "Sent", "Signed"];
const BACKUP_OPTS = ["Not Started", "In Progress", "Done"];

const INPUT_STYLE = { background: T.inset, borderColor: T.border, color: T.ink } as const;

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toForm(session: AdminClientSessionDTO | null | undefined): AdminSessionFormPayload {
  if (!session) return BLANK_FORM;

  return {
    clientEmail: session.clientEmail,
    clientName: session.clientName ?? "",
    sessionType: session.sessionType ?? "",
    sessionDate: toDateTimeInput(session.sessionDate),
    location: session.location ?? "",
    meetingPoint: session.meetingPoint ?? "",
    currentStatus: session.currentStatus,
    estimatedDeliveryDate: session.estimatedDeliveryDate ?? "",
    galleryUrl: session.galleryUrl ?? "",
    invoiceStatus: session.invoiceStatus ?? "",
    contractStatus: session.contractStatus ?? "",
    backupStatus: session.backupStatus ?? "",
    internalNotes: session.internalNotes ?? "",
    clientNotes: session.clientNotes ?? "",
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ color: T.action, fontFamily: T.mono }}
    >
      {children}
    </label>
  );
}

function StatusBtns({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
          className="rounded-lg border px-3 py-1.5 text-xs font-black transition-colors"
          style={{
            background: value === opt ? T.action : T.inset,
            borderColor: value === opt ? T.action : T.border,
            color: value === opt ? T.actionText : T.inkSoft,
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function AdminSessionForm({
  initialSession,
  contacts,
  saving,
  onSubmit,
}: AdminSessionFormProps) {
  const [form, setForm] = useState<AdminSessionFormPayload>(toForm(initialSession));
  const [notesLoading, setNotesLoading] = useState(false);
  const editing = Boolean(initialSession);

  useEffect(() => {
    setForm(toForm(initialSession));
  }, [initialSession]);

  function update<K extends keyof AdminSessionFormPayload>(key: K, value: AdminSessionFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;

    setForm((prev) => ({
      ...prev,
      clientEmail: contact.email,
      clientName: contact.name ?? prev.clientName,
      sessionType: contact.sessionType ?? prev.sessionType,
      sessionDate: contact.sessionDate ? toDateTimeInput(contact.sessionDate) : prev.sessionDate,
      location: contact.location ?? prev.location,
    }));
  }

  async function fetchNotes() {
    if (!form.clientEmail) return;
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/admin/client-notes?email=${encodeURIComponent(form.clientEmail)}`);
      const json = await res.json();
      if (!res.ok) { console.error("[client-notes]", json.error); return; }
      if (json.notes) update("clientNotes", json.notes);
    } catch (err) {
      console.error("[client-notes]", err);
    } finally {
      setNotesLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
    if (!editing) setForm(BLANK_FORM);
  }

  return (
    <form onSubmit={handleSubmit}>
      {editing && (
        <div className="mb-5 rounded-lg border p-4" style={{ background: T.inset, borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.action, fontFamily: T.mono }}>
            Editing now
          </div>
          <p className="mt-1 break-words text-sm font-bold" style={{ color: T.ink }}>
            {initialSession?.clientName || "Unnamed client"} {initialSession?.clientEmail ? `(${initialSession.clientEmail})` : ""}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5" style={{ color: T.inkFaint }}>
            {initialSession?.clientUserId
              ? "This session is already linked to a Google account. That link will stay intact unless you change the client email."
              : "This session will link to the client automatically the first time they sign in with the matching Google email."}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {contacts.length > 0 && (
          <div className="grid gap-2 md:col-span-2">
            <FieldLabel>Choose existing client</FieldLabel>
            <select
              defaultValue=""
              onChange={(event) => selectContact(event.target.value)}
              className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
              style={INPUT_STYLE}
            >
              <option value="">Select from inquiries or past sessions</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || contact.email} - {contact.email}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-2">
          <FieldLabel>Client email</FieldLabel>
          <input
            required
            type="email"
            value={form.clientEmail}
            onChange={(event) => update("clientEmail", event.target.value)}
            data-admin-session-primary
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Client name</FieldLabel>
          <input
            value={form.clientName}
            onChange={(event) => update("clientName", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Session type</FieldLabel>
          <input
            value={form.sessionType}
            onChange={(event) => update("sessionType", event.target.value)}
            placeholder="Graduation, family, couples..."
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Session date</FieldLabel>
          <input
            type="datetime-local"
            value={form.sessionDate}
            onChange={(event) => update("sessionDate", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Location</FieldLabel>
          <input
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Meeting point</FieldLabel>
          <input
            value={form.meetingPoint}
            onChange={(event) => update("meetingPoint", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Status</FieldLabel>
          <select
            value={form.currentStatus}
            onChange={(event) => update("currentStatus", event.target.value as ClientSessionStatus)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          >
            {CLIENT_SESSION_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>{CLIENT_SESSION_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <FieldLabel>Estimated delivery</FieldLabel>
          <input
            type="date"
            value={form.estimatedDeliveryDate}
            onChange={(event) => update("estimatedDeliveryDate", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Gallery URL</FieldLabel>
          <input
            type="url"
            value={form.galleryUrl}
            onChange={(event) => update("galleryUrl", event.target.value)}
            placeholder="https://..."
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Invoice status</FieldLabel>
          <StatusBtns value={form.invoiceStatus} onChange={(v) => update("invoiceStatus", v)} opts={INVOICE_OPTS} />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Contract status</FieldLabel>
          <StatusBtns value={form.contractStatus} onChange={(v) => update("contractStatus", v)} opts={CONTRACT_OPTS} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Backup status</FieldLabel>
          <StatusBtns value={form.backupStatus} onChange={(v) => update("backupStatus", v)} opts={BACKUP_OPTS} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Client notes</FieldLabel>
            {form.clientEmail && (
              <button
                type="button"
                onClick={fetchNotes}
                disabled={notesLoading}
                className="rounded-lg border px-2 py-1 text-[10px] font-black disabled:opacity-50"
                style={{ background: T.amberBg, borderColor: T.amberBorder, color: T.amber }}
              >
                {notesLoading ? "Pulling..." : "Pull from Gmail"}
              </button>
            )}
          </div>
          <textarea
            value={form.clientNotes}
            onChange={(event) => update("clientNotes", event.target.value)}
            rows={3}
            className="w-full min-w-0 rounded-lg border px-3 py-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Internal notes</FieldLabel>
          <textarea
            value={form.internalNotes}
            onChange={(event) => update("internalNotes", event.target.value)}
            rows={3}
            className="w-full min-w-0 rounded-lg border px-3 py-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-6 min-h-12 w-full rounded-lg px-5 text-sm font-black disabled:opacity-60"
        style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}
      >
        {saving ? "Saving..." : editing ? "Save session" : "Create session"}
      </button>
    </form>
  );
}
