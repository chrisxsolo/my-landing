"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PortalStyleTag from "@/app/components/portal-style-tag";
import SessionCard from "@/app/components/session-card";
import { G } from "@/lib/portalTheme";
import { buildGmailComposeUrl } from "@/lib/contactEmail";
import {
  CLIENT_SESSION_STATUS_LABELS,
  formatClientSessionDateTime,
  type ClientSessionDTO,
} from "@/lib/clientSessions";
import {
  buildPortalStatusPhrase,
  getPortalFirstName,
  selectActivePortalSession,
} from "@/lib/portalSessionDisplay";
import { supabase } from "@/lib/supabase";

type ClientSessionsResponse = {
  sessions?: ClientSessionDTO[];
  error?: string;
};

const DASHBOARD_STYLES = `
  .pd-row {
    width: 100%;
    text-align: left;
    background: ${G.panel};
    border: 1px solid ${G.border};
    border-radius: 12px;
    padding: 14px 18px;
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .pd-row:hover { border-color: ${G.borderStrong}; box-shadow: ${G.shadow}; }
  .pd-row[data-open="true"] {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

export default function ClientSessionDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ClientSessionDTO[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const contactChrisUrl = buildGmailComposeUrl({
    subject: "SoloXSnaps client portal question",
    body: email
      ? `Hi Chris,\n\nI'm reaching out from the client portal.\n\nMy account email: ${email}\n\nQuestion:\n`
      : "Hi Chris,\n\nI'm reaching out from the client portal.\n\nQuestion:\n",
  });

  const activeSession = selectActivePortalSession(sessions);
  const otherSessions = activeSession
    ? sessions.filter((s) => s.id !== activeSession.id)
    : [];
  const firstName = activeSession ? getPortalFirstName(activeSession.clientName) : null;

  if (loading) {
    return (
      <main className="gp-root px-5 py-8 md:px-8 md:py-10">
        <PortalStyleTag />
        <div className="mx-auto max-w-4xl">
          <div className="gp-skeleton mb-8 h-8 w-56" />
          <div className="gp-skeleton mb-4 h-24 w-full max-w-xl" />
          <div className="gp-skeleton h-80 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="gp-root px-5 py-8 md:px-8 md:py-10">
      <PortalStyleTag />
      <style>{DASHBOARD_STYLES}</style>

      <div className="mx-auto max-w-4xl">

        {/* Top bar */}
        <header className="gp-in mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="gp-mono" style={{ color: G.accent, textDecoration: "none" }}>
            Soloxsnaps · Client Gallery
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {email && <span className="gp-mono" style={{ marginRight: "4px" }}>{email}</span>}
            <a href={contactChrisUrl} target="_blank" rel="noopener noreferrer" className="gp-ghost">
              Email Chris
            </a>
            <button type="button" onClick={signOut} className="gp-ghost">
              Sign out
            </button>
          </div>
        </header>

        {error ? (
          <div className="gp-panel gp-in" style={{ padding: "26px 28px" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: G.red, margin: 0 }}>{error}</p>
          </div>
        ) : !activeSession ? (
          /* Empty state */
          <div className="gp-panel gp-in" style={{ padding: "34px 32px" }}>
            <h1 className="gp-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", margin: 0, lineHeight: 1.1 }}>
              No linked session<br />
              <em style={{ fontStyle: "italic", color: G.inkSoft }}>yet.</em>
            </h1>
            <p style={{ marginTop: "14px", fontSize: "13px", color: G.inkSoft, lineHeight: 1.7, maxWidth: "420px" }}>
              No session is connected to this email. If you recently booked, your
              session may not be linked yet — send a note and Chris will connect it.
            </p>
            <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <a href={contactChrisUrl} target="_blank" rel="noopener noreferrer" className="gp-btn">
                Email Chris
              </a>
              <Link href="/" className="gp-ghost">Return to main site</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Hero: active session */}
            <section className="gp-in" style={{ animationDelay: "60ms" }}>
              <div className="gp-mono" style={{ color: G.accent, marginBottom: "12px" }}>
                {[activeSession.sessionType, formatClientSessionDateTime(activeSession.sessionDate)]
                  .filter(Boolean)
                  .join(" · ") || "Your session"}
              </div>
              <h1 className="gp-display" style={{
                fontSize: "clamp(2rem, 5vw, 3.2rem)",
                lineHeight: 1.08,
                margin: 0,
                maxWidth: "640px",
              }}>
                {firstName ? `Hi ${firstName} —` : "Welcome back —"}<br />
                <em style={{ fontStyle: "italic", color: G.inkSoft }}>
                  {buildPortalStatusPhrase(activeSession)}
                </em>
              </h1>
              <div style={{ marginTop: "26px" }}>
                <SessionCard session={activeSession} />
              </div>
            </section>

            {/* Other sessions */}
            {otherSessions.length > 0 && (
              <section className="gp-in" style={{ animationDelay: "140ms", marginTop: "40px" }}>
                <div className="gp-mono" style={{ marginBottom: "12px" }}>Other sessions</div>
                <div className="flex flex-col gap-2.5">
                  {otherSessions.map((session) => {
                    const open = expandedId === session.id;
                    const delivered = session.currentStatus === "delivered";
                    return (
                      <div key={session.id}>
                        <button
                          type="button"
                          className="pd-row"
                          data-open={open}
                          onClick={() => setExpandedId(open ? null : session.id)}
                          aria-expanded={open}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="gp-display" style={{ fontSize: "17px", lineHeight: 1.25 }}>
                                {session.sessionType || "Photo session"}
                              </div>
                              <div className="gp-mono" style={{ marginTop: "4px" }}>
                                {formatClientSessionDateTime(session.sessionDate)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className="gp-chip" data-done={delivered}>
                                {CLIENT_SESSION_STATUS_LABELS[session.currentStatus]}
                              </span>
                              <span aria-hidden style={{ color: G.inkFaint, fontSize: "12px" }}>
                                {open ? "▴" : "▾"}
                              </span>
                            </div>
                          </div>
                        </button>
                        {open && <SessionCard session={session} />}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Footer line */}
            <p className="gp-mono gp-in" style={{ animationDelay: "200ms", marginTop: "40px", letterSpacing: "0.1em" }}>
              Securely matched to your account email — only your linked sessions appear here.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
