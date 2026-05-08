"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SessionCard from "@/app/components/session-card";
import { C } from "@/lib/colors";
import type { ClientSessionDTO } from "@/lib/clientSessions";
import { supabase } from "@/lib/supabase";

type ClientSessionsResponse = {
  sessions?: ClientSessionDTO[];
  error?: string;
};

export default function ClientSessionDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ClientSessionDTO[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSessions() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const token = session?.access_token;

      if (!token) {
        router.replace("/login?next=/dashboard");
        return;
      }

      setEmail(session.user.email ?? null);

      const res = await fetch("/api/client-sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as ClientSessionsResponse;

      if (!alive) return;
      if (!res.ok) {
        setError(json.error ?? "Could not load your session dashboard.");
        setLoading(false);
        return;
      }

      setSessions(json.sessions ?? []);
      setLoading(false);
    }

    loadSessions().catch((err) => {
      console.error("[client-dashboard]", err);
      if (alive) {
        setError("Could not load your session dashboard.");
        setLoading(false);
      }
    });

    return () => { alive = false; };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen px-5 py-10 md:px-8" style={{ background: C.page }}>
        <div className="mx-auto max-w-5xl">
          <div className="h-6 w-44 animate-pulse rounded" style={{ background: C.p1_08 }} />
          <div className="mt-8 h-96 animate-pulse rounded-xl" style={{ background: C.surfaceStrong }} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8 md:px-8 md:py-10" style={{ background: C.page }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm font-black" style={{ color: C.p1 }}>
              SoloXSnaps
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-normal md:text-5xl" style={{ color: C.ink }}>
              Session dashboard
            </h1>
            {email && (
              <p className="mt-2 text-sm font-semibold" style={{ color: C.muted }}>
                Signed in as {email}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border px-4 text-sm font-black"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
          >
            Sign out
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border p-5" style={{ background: C.surfaceStrong, borderColor: C.borderWarm }}>
            <p className="text-sm font-bold" style={{ color: C.danger }}>{error}</p>
          </div>
        ) : sessions.length > 0 ? (
          <div className="grid gap-5">
            {sessions.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        ) : (
          <div className="rounded-xl border p-6 md:p-8" style={{ background: C.surfaceSoft, borderColor: C.borderWarm }}>
            <h2 className="text-2xl font-black" style={{ color: C.ink }}>No linked session yet</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6" style={{ color: C.muted }}>
              No session is currently linked to this email. If you recently booked, your session may not be connected yet.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
