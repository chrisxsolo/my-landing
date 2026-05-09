"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AdminSessionForm, {
  ADMIN_SESSION_FORM_ID,
  type AdminSessionFormPayload,
} from "@/app/components/admin-session-form";
import AdminSessionTable from "@/app/components/admin-session-table";
import { C } from "@/lib/colors";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import type { ClientSessionContactOption } from "@/lib/clientSessionContacts";
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSessions() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login?next=/admin/sessions");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [sessionsRes, contactsRes] = await Promise.all([
        fetch("/api/admin/sessions", { headers }),
        fetch("/api/admin/session-contacts", { headers }),
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

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("You are not signed in.");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen px-5 py-8" style={{ background: C.page }}>
        <div className="mx-auto max-w-6xl">
          <div className="h-10 w-64 animate-pulse rounded" style={{ background: C.p1_08 }} />
          <div className="mt-6 h-96 animate-pulse rounded-xl" style={{ background: C.surfaceStrong }} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden px-5 py-8 md:px-8 md:py-10" style={{ background: C.page }}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-black" style={{ color: C.p1 }}>
              Admin
            </Link>
            <h1 className="mt-3 text-3xl font-black md:text-5xl" style={{ color: C.ink }}>
              Client sessions
            </h1>
            <p className="mt-2 text-sm font-semibold" style={{ color: C.muted }}>
              Create, update, and deliver session progress for the client portal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-black"
              style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
            >
              Client view
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="min-h-10 rounded-lg border px-4 text-sm font-black"
              style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.muted }}
            >
              Sign out
            </button>
          </div>
        </header>

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

            <AdminSessionTable sessions={filteredSessions} onEdit={setEditing} />
          </section>
        </div>
      </div>
    </main>
  );
}
