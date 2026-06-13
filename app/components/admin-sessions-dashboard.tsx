"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminSessionDrawer from "@/app/components/admin-session-drawer";
import AdminSessionForm, {
  type AdminSessionFormPayload,
} from "@/app/components/admin-session-form";
import AdminSessionTable from "@/app/components/admin-session-table";
import ClientPortalPreview from "@/app/admin/ClientPortalPreview";
import { T } from "@/app/admin/adminTheme";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import type { ClientSessionContactOption } from "@/lib/clientSessionContacts";
import { checkAuth } from "@/lib/adminAuth";
import {
  filterAdminPortalSessions,
  resolveAdminPortalSessionFocus,
} from "@/lib/adminPortalSessionNavigation";
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

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

const DARK_INPUT = { background: T.inset, borderColor: T.border, color: T.ink } as const;

export default function AdminSessionsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedFocusKey = useRef<string | null>(null);
  const [sessions, setSessions] = useState<AdminClientSessionDTO[]>([]);
  const [contacts, setContacts] = useState<ClientSessionContactOption[]>([]);
  const [editing, setEditing] = useState<AdminClientSessionDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
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

  // Focus the first form field when the drawer opens.
  useEffect(() => {
    if (!drawerOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>("[data-admin-session-primary]");
      input?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [drawerOpen]);

  useEffect(() => {
    if (loading) return;
    const focusKey = searchParams.toString();
    if (appliedFocusKey.current === focusKey) return;

    const focus = resolveAdminPortalSessionFocus(sessions, searchParams);
    appliedFocusKey.current = focusKey;
    if (!focus.clientQuery) {
      setQuery("");
      setFocusedSessionId(null);
      return;
    }

    setQuery(focus.clientQuery);
    setFocusedSessionId(focus.sessionId);
    setStatusFilter("all");
  }, [loading, searchParams, sessions]);

  const filteredSessions = useMemo(() => {
    return filterAdminPortalSessions(sessions, {
      query,
      statusFilter,
      focusedSessionId,
    });
  }, [focusedSessionId, query, sessions, statusFilter]);

  async function getAuthHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token && !checkAuth()) throw new Error("You are not signed in.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  function openCreateDrawer() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(session: AdminClientSessionDTO) {
    setEditing(session);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
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
      setMessage(editing ? "Session updated." : "Session created.");
      closeDrawer();
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
      <main className="relative min-h-screen px-5 py-8" style={{ background: T.page }}>
        <link rel="stylesheet" href={FONTS_URL} />
        <div className="pointer-events-none absolute inset-0" style={{ background: T.canvasGlow }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="h-10 w-64 animate-pulse rounded" style={{ background: T.inset }} />
          <div className="mt-6 h-96 animate-pulse rounded-xl" style={{ background: T.panel }} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden px-5 py-8 md:px-8 md:py-10" style={{ background: T.page }}>
      <link rel="stylesheet" href={FONTS_URL} />
      <div className="pointer-events-none absolute inset-0" style={{ background: T.canvasGlow }} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{ color: T.action, fontFamily: T.mono, textDecoration: "none" }}
            >
              ← The Darkroom
            </Link>
            <h1 className="mt-3 text-3xl md:text-5xl" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>
              Portal Sessions
            </h1>
            <p className="mt-2 text-sm font-semibold" style={{ color: T.inkFaint }}>
              Manage client portal progress, linking, and delivery visibility.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={scanSentEmails}
              disabled={scanningInvoices}
              title="Scan Gmail to auto-fill session dates, delivery dates, invoice/contract statuses, and deposit payments"
              className="min-h-10 rounded-lg px-4 text-sm font-black disabled:opacity-60"
              style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}
            >
              {scanningInvoices ? "Scanning…" : "Scan Gmail"}
            </button>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="min-h-10 rounded-lg border px-4 text-sm font-black"
              style={{ background: T.insetStrong, borderColor: T.borderStrong, color: T.ink }}
            >
              + New session
            </button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-black"
              style={{ background: T.panel, borderColor: T.border, color: T.inkSoft }}
            >
              Client view
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="min-h-10 rounded-lg border px-4 text-sm font-black"
              style={{ background: T.panel, borderColor: T.border, color: T.inkFaint }}
            >
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-lg border p-4 text-sm font-bold" style={{ background: T.redBg, borderColor: T.redBorder, color: T.red }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-lg border p-4 text-sm font-bold" style={{ background: T.greenBg, borderColor: T.greenBorder, color: T.green }}>
            {message}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-4 rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              value={query}
              onChange={(event) => {
                setFocusedSessionId(null);
                setQuery(event.target.value);
              }}
              placeholder="Search name, email, type, location, date..."
              className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
              style={DARK_INPUT}
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setFocusedSessionId(null);
                setStatusFilter(event.target.value as ClientSessionStatus | "all");
              }}
              className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
              style={DARK_INPUT}
            >
              <option value="all">All statuses</option>
              {CLIENT_SESSION_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>{CLIENT_SESSION_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.inkFaint, fontFamily: T.mono }}>
            {filteredSessions.length} of {sessions.length} sessions
          </p>
        </div>

        <AdminSessionTable
          sessions={filteredSessions}
          onEdit={openEditDrawer}
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
      </div>

      <AdminSessionDrawer
        open={drawerOpen}
        title={editing ? "Edit session" : "New session"}
        onClose={closeDrawer}
      >
        <AdminSessionForm
          initialSession={editing}
          contacts={contacts}
          saving={saving}
          onSubmit={saveSession}
        />
      </AdminSessionDrawer>

      {previewEmail && (
        <ClientPortalPreview
          email={previewEmail}
          onClose={() => setPreviewEmail(null)}
        />
      )}
    </main>
  );
}
