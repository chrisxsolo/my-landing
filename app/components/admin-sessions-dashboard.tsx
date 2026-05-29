"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AdminSessionForm, {
  ADMIN_SESSION_FORM_ID,
  type AdminSessionFormPayload,
} from "@/app/components/admin-session-form";
import AdminSessionTable from "@/app/components/admin-session-table";
import ClientPortalPreview from "@/app/admin/ClientPortalPreview";
import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import type { ClientSessionContactOption } from "@/lib/clientSessionContacts";
import { checkAuth } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

type AdminSessionsResponse = {
  sessions?: AdminClientSessionDTO[];
  session?: AdminClientSessionDTO;
  error?: string;
};

type AdminSessionContactsResponse = {
  contacts?: ClientSessionContactOption[];
  error?: string;
};

function matchesQuery(session: AdminClientSessionDTO, query: string) {
  const haystack = [
    session.clientName,
    session.clientEmail,
    session.sessionType,
    session.location,
    session.meetingPoint,
    session.currentStatus,
    session.sessionDate,
  ].join(" ").toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export default function AdminSessionsDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminClientSessionDTO[]>([]);
  const [contacts, setContacts] = useState<ClientSessionContactOption[]>([]);
  const [editing, setEditing] = useState<AdminClientSessionDTO | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientSessionStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState<{
    id: string;
    status: ClientSessionStatus;
  } | null>(null);
  const [gmailSyncing, setGmailSyncing] = useState<string | null>(null);
  const [scanningInvoices, setScanningInvoices] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSessions() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token && !checkAuth()) {
        router.replace("/login?next=/admin/sessions");
        return;
      }

      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [sessionsRes, contactsRes] = await Promise.all([
        fetch("/api/admin/sessions", { headers: authHeaders }),
        fetch("/api/admin/session-contacts", { headers: authHeaders }),
      ]);
      const json = await sessionsRes.json() as AdminSessionsResponse;
      const contactsJson = await contactsRes.json() as AdminSessionContactsResponse;

      if (!alive) return;
      if (!sessionsRes.ok) {
        setError(sessionsRes.status === 403 ? "Your Google account is not listed in admin_users yet." : json.error ?? "Could not load sessions.");
        setLoading(false);
        return;
      }

      setSessions(json.sessions ?? []);
      if (contactsRes.ok) setContacts(contactsJson.contacts ?? []);
      setLoading(false);
    }

    loadSessions().catch((err) => {
      console.error("[admin-sessions-dashboard]", err);
      if (alive) {
        setError("Could not load sessions.");
        setLoading(false);
      }
    });

    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    if (!editing) return;

    const frame = window.requestAnimationFrame(() => {
      const form = document.getElementById(ADMIN_SESSION_FORM_ID);
      if (!form) return;

      form.scrollIntoView({ behavior: "smooth", block: "start" });
      const input = form.querySelector<HTMLInputElement>("[data-admin-session-primary]");
      input?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const queryMatch = query.trim() ? matchesQuery(session, query.trim()) : true;
      const statusMatch = statusFilter === "all" || session.currentStatus === statusFilter;
      return queryMatch && statusMatch;
    });
  }, [query, sessions, statusFilter]);

  async function getAuthHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token && !checkAuth()) throw new Error("You are not signed in.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function saveSession(payload: AdminSessionFormPayload) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
      });
      const json = await res.json() as AdminSessionsResponse;

      if (!res.ok || !json.session) {
        setError(json.error ?? "Could not save session.");
        return;
      }

      setSessions((prev) => {
        if (!editing) return [json.session!, ...prev];
        return prev.map((session) => session.id === json.session!.id ? json.session! : session);
      });
      setEditing(null);
      setMessage(editing ? "Session updated." : "Session created.");
    } catch (err) {
      console.error("[admin-sessions-dashboard] save", err);
      setError("Could not save session.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSessionStatus(session: AdminClientSessionDTO, status: ClientSessionStatus) {
    setStatusSaving({ id: session.id, status });
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          quickStatusUpdate: true,
          id: session.id,
          clientEmail: session.clientEmail,
          clientName: session.clientName,
          sessionType: session.sessionType,
          sessionDate: session.sessionDate,
          location: session.location,
          currentStatus: status,
        }),
      });
      const json = await res.json() as AdminSessionsResponse;

      if (!res.ok || !json.session) {
        setError(json.error ?? "Could not update session progress.");
        return;
      }

      setSessions((prev) => prev.map((item) => item.id === json.session!.id ? json.session! : item));
      setMessage(`Updated ${json.session.clientName || "client"} to ${CLIENT_SESSION_STATUS_LABELS[status]}.`);
    } catch (err) {
      console.error("[admin-sessions-dashboard] quick status", err);
      setError("Could not update session progress.");
    } finally {
      setStatusSaving(null);
    }
  }

  async function syncFromGmail(session: AdminClientSessionDTO) {
    setGmailSyncing(session.id);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions/sync-gmail", {
        method: "POST",
        headers,
        body: JSON.stringify({ session_id: session.id }),
      });
      const json = await res.json() as { session?: AdminClientSessionDTO; message?: string; error?: string };

      if (!res.ok) {
        setError(json.error ?? "Gmail sync failed.");
        return;
      }

      if (json.session) {
        setSessions((prev) => prev.map((item) => item.id === json.session!.id ? json.session! : item));
      }
      setMessage(json.message ?? "Synced from Gmail.");
    } catch (err) {
      console.error("[admin-sessions-dashboard] gmail sync", err);
      setError("Gmail sync failed.");
    } finally {
      setGmailSyncing(null);
    }
  }

  async function scanSentEmails() {
    setScanningInvoices(true);
    setError(null);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions/sync-sent-invoices", {
        method: "POST",
        headers,
      });
      const json = await res.json() as { updated?: string[]; message?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Scan failed.");
        return;
      }
      setMessage(json.message ?? "Scan complete.");
      if (json.updated?.length) {
        // Reload sessions to reflect the new statuses
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const sessionsRes = await fetch("/api/admin/sessions", { headers: authHeaders });
        if (sessionsRes.ok) {
          const sessionsJson = await sessionsRes.json() as AdminSessionsResponse;
          setSessions(sessionsJson.sessions ?? []);
        }
      }
    } catch (err) {
      console.error("[admin-sessions-dashboard] scanSentEmails", err);
      setError("Scan failed.");
    } finally {
      setScanningInvoices(false);
    }
  }

  async function deleteSession(session: AdminClientSessionDTO) {
    setDeletingId(session.id);
    setError(null);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id: session.id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Could not delete session."); return; }
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setMessage(`Deleted session for ${session.clientName || session.clientEmail}.`);
    } catch (err) {
      console.error("[admin-sessions-dashboard] delete", err);
      setError("Could not delete session.");
    } finally {
      setDeletingId(null);
    }
  }

  async function unlinkAccount(session: AdminClientSessionDTO) {
    setUnlinkingId(session.id);
    setError(null);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: session.id, clientEmail: session.clientEmail, unlinkAccount: true }),
      });
      const json = await res.json() as AdminSessionsResponse;
      if (!res.ok || !json.session) { setError(json.error ?? "Could not unlink account."); return; }
      setSessions((prev) => prev.map((s) => s.id === json.session!.id ? json.session! : s));
      setMessage(`Google account unlinked from ${session.clientName || session.clientEmail}.`);
    } catch (err) {
      console.error("[admin-sessions-dashboard] unlink", err);
      setError("Could not unlink account.");
    } finally {
      setUnlinkingId(null);
    }
  }

  async function updateSessionField(session: AdminClientSessionDTO, fields: Record<string, unknown>) {
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: session.id, clientEmail: session.clientEmail, ...fields }),
      });
      const json = await res.json() as AdminSessionsResponse;
      if (!res.ok || !json.session) { setError(json.error ?? "Could not update session."); return; }
      setSessions((prev) => prev.map((s) => s.id === json.session!.id ? json.session! : s));
    } catch (err) {
      console.error("[admin-sessions-dashboard] updateField", err);
      setError("Could not update session.");
    }
  }

  function moveSession(id: string, direction: "up" | "down") {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;
      const next = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main
        className="relative min-h-screen overflow-hidden px-5 py-8"
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            ...C.gridBg(0.035),
            maskImage: "radial-gradient(circle at 50% 30%, black, transparent 82%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: C.blob1, opacity: 0.9 }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl"
          style={{ background: C.blob2, opacity: 0.75 }}
        />
        <div className="mx-auto max-w-6xl">
          <div className="h-10 w-64 animate-pulse rounded" style={{ background: C.p1_08 }} />
          <div className="mt-6 h-96 animate-pulse rounded-xl" style={{ background: C.surfaceStrong }} />
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-x-hidden px-5 py-8 md:px-8 md:py-10"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          ...C.gridBg(0.035),
          maskImage: "radial-gradient(circle at 50% 30%, black, transparent 82%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full blur-3xl"
        style={{ background: C.blob1, opacity: 0.9 }}
      />
      <div
        className="pointer-events-none absolute right-[-3rem] top-32 h-64 w-64 rounded-full blur-3xl"
        style={{ background: C.blob3, opacity: 0.55 }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl"
        style={{ background: C.blob2, opacity: 0.75 }}
      />
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-black" style={{ color: C.p1 }}>
              Studio Admin
            </Link>
            <h1 className="mt-3 text-3xl font-black md:text-5xl" style={{ color: C.ink }}>
              Portal Sessions
            </h1>
            <p className="mt-2 text-sm font-semibold" style={{ color: C.muted }}>
              Manage client portal progress, linking, and delivery visibility.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-black"
              style={{ background: "rgba(255,255,255,0.68)", borderColor: C.borderSubtle, color: C.inkSoft, backdropFilter: "blur(14px)" }}
            >
              Studio Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-black"
              style={{ background: "rgba(255,255,255,0.68)", borderColor: C.borderSubtle, color: C.inkSoft, backdropFilter: "blur(14px)" }}
            >
              Client view
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="min-h-10 rounded-lg border px-4 text-sm font-black"
              style={{ background: "rgba(255,255,255,0.68)", borderColor: C.borderSubtle, color: C.muted, backdropFilter: "blur(14px)" }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Prominent scan banner */}
        <div
          className="mb-6 rounded-xl border p-4 md:p-5"
          style={{ background: C.p1_08, borderColor: C.p1_20 }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                Gmail sync
              </div>
              <p className="mt-1 text-sm font-bold" style={{ color: C.ink }}>
                Scan your Gmail to auto-fill session dates, delivery dates, invoice/contract statuses, and deposit payments.
              </p>
              <p className="mt-0.5 text-xs font-semibold" style={{ color: C.muted }}>
                Run any time to catch missed updates or double-check everything is current.
              </p>
            </div>
            <button
              type="button"
              onClick={scanSentEmails}
              disabled={scanningInvoices}
              className="flex-shrink-0 min-h-11 rounded-xl px-6 text-sm font-black disabled:opacity-60"
              style={{ background: C.p1, color: "#fff" }}
            >
              {scanningInvoices ? "Scanning…" : "Scan Gmail Now"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border p-4 text-sm font-bold" style={{ background: C.surfaceStrong, borderColor: C.borderWarm, color: C.danger }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-lg border p-4 text-sm font-bold" style={{ background: C.surfaceStrong, borderColor: C.borderWarm, color: C.success }}>
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <AdminSessionForm
            initialSession={editing}
            contacts={contacts}
            saving={saving}
            onSubmit={saveSession}
            onCancelEdit={() => setEditing(null)}
          />

          <section className="grid min-w-0 content-start gap-4">
            {editing && (
              <div className="rounded-xl border p-4" style={{ background: C.surfaceSoft, borderColor: C.borderWarm }}>
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                  Edit mode
                </div>
                <p className="mt-1 break-words text-sm font-bold" style={{ color: C.ink }}>
                  Updating {editing.clientName || "Unnamed client"} for {editing.clientEmail}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5" style={{ color: C.muted }}>
                  On mobile, the form opens above this list and scrolls into view automatically.
                </p>
              </div>
            )}

            <div className="rounded-xl border p-4" style={{ background: C.surfaceSoft, borderColor: C.borderWarm }}>
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email, type, location, date..."
                  className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ClientSessionStatus | "all")}
                  className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.ink }}
                >
                  <option value="all">All statuses</option>
                  {CLIENT_SESSION_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>{CLIENT_SESSION_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </div>
            </div>

            <AdminSessionTable
              sessions={filteredSessions}
              onEdit={setEditing}
              onPreview={setPreviewEmail}
              onUpdateStatus={updateSessionStatus}
              statusSaving={statusSaving}
              gmailSyncing={gmailSyncing}
              onSyncFromGmail={syncFromGmail}
              onDelete={deleteSession}
              onUnlinkAccount={unlinkAccount}
              onUpdateInvoice={(session, status) => updateSessionField(session, { invoiceStatus: status ?? "" })}
              onUpdateContract={(session, status) => updateSessionField(session, { contractStatus: status ?? "" })}
              onUpdateField={updateSessionField}
              onMoveUp={(id) => moveSession(id, "up")}
              onMoveDown={(id) => moveSession(id, "down")}
              deletingId={deletingId}
              unlinkingId={unlinkingId}
            />
          </section>
        </div>
      </div>

      {previewEmail && (
        <ClientPortalPreview
          email={previewEmail}
          onClose={() => setPreviewEmail(null)}
        />
      )}
    </main>
  );
}
