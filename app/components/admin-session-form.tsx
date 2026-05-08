"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

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
  saving: boolean;
  onSubmit: (payload: AdminSessionFormPayload) => Promise<void>;
  onCancelEdit?: () => void;
};

const BLANK_FORM: AdminSessionFormPayload = {
  clientEmail: "",
  clientName: "",
  sessionType: "",
  sessionDate: "",
  location: "",
  meetingPoint: "",
  currentStatus: "booked",
  estimatedDeliveryDate: "",
  galleryUrl: "",
  invoiceStatus: "",
  contractStatus: "",
  backupStatus: "",
  internalNotes: "",
  clientNotes: "",
};

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
    <label className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
      {children}
    </label>
  );
}

export default function AdminSessionForm({
  initialSession,
  saving,
  onSubmit,
  onCancelEdit,
}: AdminSessionFormProps) {
  const [form, setForm] = useState<AdminSessionFormPayload>(toForm(initialSession));
  const editing = Boolean(initialSession);

  useEffect(() => {
    setForm(toForm(initialSession));
  }, [initialSession]);

  function update<K extends keyof AdminSessionFormPayload>(key: K, value: AdminSessionFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
    if (!editing) setForm(BLANK_FORM);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-5"
      style={{ background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black" style={{ color: C.ink }}>
            {editing ? "Edit session" : "Create session"}
          </h2>
          <p className="mt-1 text-sm font-semibold" style={{ color: C.muted }}>
            Use the client&apos;s Google email so their dashboard links automatically.
          </p>
        </div>

        {editing && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg border px-3 py-2 text-xs font-black"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.muted }}
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel>Client email</FieldLabel>
          <input
            required
            type="email"
            value={form.clientEmail}
            onChange={(event) => update("clientEmail", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Client name</FieldLabel>
          <input
            value={form.clientName}
            onChange={(event) => update("clientName", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Session type</FieldLabel>
          <input
            value={form.sessionType}
            onChange={(event) => update("sessionType", event.target.value)}
            placeholder="Graduation, family, couples..."
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Session date</FieldLabel>
          <input
            type="datetime-local"
            value={form.sessionDate}
            onChange={(event) => update("sessionDate", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Location</FieldLabel>
          <input
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Meeting point</FieldLabel>
          <input
            value={form.meetingPoint}
            onChange={(event) => update("meetingPoint", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Status</FieldLabel>
          <select
            value={form.currentStatus}
            onChange={(event) => update("currentStatus", event.target.value as ClientSessionStatus)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
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
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Gallery URL</FieldLabel>
          <input
            type="url"
            value={form.galleryUrl}
            onChange={(event) => update("galleryUrl", event.target.value)}
            placeholder="https://..."
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Invoice status</FieldLabel>
          <input
            value={form.invoiceStatus}
            onChange={(event) => update("invoiceStatus", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Contract status</FieldLabel>
          <input
            value={form.contractStatus}
            onChange={(event) => update("contractStatus", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Backup status</FieldLabel>
          <input
            value={form.backupStatus}
            onChange={(event) => update("backupStatus", event.target.value)}
            className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Client notes</FieldLabel>
          <textarea
            value={form.clientNotes}
            onChange={(event) => update("clientNotes", event.target.value)}
            rows={3}
            className="rounded-lg border px-3 py-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Internal notes</FieldLabel>
          <textarea
            value={form.internalNotes}
            onChange={(event) => update("internalNotes", event.target.value)}
            rows={3}
            className="rounded-lg border px-3 py-3 text-sm font-semibold outline-none"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 min-h-12 w-full rounded-lg px-5 text-sm font-black disabled:opacity-60"
        style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
      >
        {saving ? "Saving..." : editing ? "Save session" : "Create session"}
      </button>
    </form>
  );
}
