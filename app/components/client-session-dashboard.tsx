"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SessionCard from "@/app/components/session-card";
import { C } from "@/lib/colors";
import { buildGmailComposeUrl } from "@/lib/contactEmail";
import {
  CLIENT_SESSION_STATUS_LABELS,
  type ClientSessionDTO,
} from "@/lib/clientSessions";
import { supabase } from "@/lib/supabase";

type ClientSessionsResponse = {
  sessions?: ClientSessionDTO[];
  error?: string;
};

const SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Mono:wght@300;400;500&display=swap');

  .pd-root {
    background: #f8f7f5;
    min-height: 100vh;
    font-family: ui-sans-serif, system-ui, sans-serif;
    position: relative;
    overflow-x: hidden;
  }


  /* ── Wordmark ── */
  .pd-mono {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: rgba(0,0,0,0.52);
  }

  /* ── Panel / card ── */
  .pd-panel {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 18px;
    box-shadow:
      0 0 0 0.5px rgba(0,0,0,0.03),
      0 2px 4px rgba(0,0,0,0.04),
      0 12px 32px rgba(0,0,0,0.06);
    position: relative;
    overflow: hidden;
  }

  .pd-panel::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(0,0,0,0.09) 30%,
      rgba(0,0,0,0.14) 50%,
      rgba(0,0,0,0.09) 70%,
      transparent 100%
    );
    pointer-events: none;
  }

  .pd-panel-inner {
    position: relative;
    z-index: 1;
    padding: 28px 32px;
  }

  /* ── Stat tile ── */
  .pd-stat {
    background: rgba(0,0,0,0.03);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 14px;
    padding: 20px;
    transition: border-color 200ms ease, background 200ms ease;
  }
  .pd-stat:hover {
    border-color: rgba(0,0,0,0.12);
    background: rgba(0,0,0,0.05);
  }

  /* ── Nav pill ── */
  .pd-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.10);
    background: rgba(255,255,255,0.80);
    color: rgba(0,0,0,0.50);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    text-decoration: none;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
    white-space: nowrap;
  }
  .pd-pill:hover {
    background: #ffffff;
    border-color: rgba(0,0,0,0.16);
    color: rgba(0,0,0,0.75);
  }

  /* ── Primary action ── */
  .pd-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border-radius: 8px;
    background: #111110;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: background 160ms ease;
    white-space: nowrap;
  }
  .pd-cta:hover {
    background: #1e1d1b;
  }

  /* ── Divider ── */
  .pd-rule {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,0.08) 20%, rgba(0,0,0,0.08) 80%, transparent);
  }

  /* ── Status dot ── */
  .pd-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4caf7d;
    box-shadow: 0 0 0 2px rgba(76,175,125,0.20);
    flex-shrink: 0;
  }

  /* ── Entrance ── */
  .pd-in {
    animation: pd-up 480ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
  }
  @keyframes pd-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Skeleton ── */
  .pd-skeleton {
    background: rgba(0,0,0,0.06);
    border-radius: 14px;
    animation: pd-pulse 1.8s ease-in-out infinite;
  }
  @keyframes pd-pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pd-in, .pd-skeleton { animation: none; }
  }
`;

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

  const contactChrisUrl = buildGmailComposeUrl({
    subject: "SoloXSnaps client portal question",
    body: email
      ? `Hi Chris,\n\nI'm reaching out from the client portal.\n\nMy Google account email: ${email}\n\nQuestion:\n`
      : "Hi Chris,\n\nI'm reaching out from the client portal.\n\nQuestion:\n",
  });

  const primarySession = sessions[0] ?? null;
  const deliveredCount = sessions.filter((s) => s.currentStatus === "delivered").length;
  const activeStatusLabel = primarySession
    ? CLIENT_SESSION_STATUS_LABELS[primarySession.currentStatus]
    : "No active session";

  if (loading) {
    return (
      <main className="pd-root px-5 py-8 md:px-8 md:py-10">
        <style>{SHARED_STYLES}</style>
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="pd-skeleton mb-6 h-9 w-48" />
          <div className="pd-skeleton h-64 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="pd-root px-5 py-8 md:px-8 md:py-10">
      <style>{SHARED_STYLES}</style>

      <div className="relative z-10 mx-auto max-w-5xl">

        {/* ── Top nav ── */}
        <header
          className="pd-in mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDelay: "0ms" }}
        >
          <Link href="/" className="pd-pill">
            ← Back to soloxsnaps.com
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {email && (
              <span className="pd-mono" style={{ marginRight: "4px" }}>
                {email}
              </span>
            )}
            <a
              href={contactChrisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pd-pill"
            >
              Email Chris
            </a>
            <button type="button" onClick={signOut} className="pd-pill">
              Sign out
            </button>
          </div>
        </header>

        {/* ── Hero panel ── */}
        <section
          className="pd-panel pd-in mb-6"
          style={{ animationDelay: "60ms" }}
        >
          <div className="pd-panel-inner">
            {/* Label row */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="pd-mono">Client portal</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div className="pd-dot" />
                <span className="pd-mono" style={{ color: "rgba(0,0,0,0.45)" }}>Live</span>
              </div>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                  fontWeight: 400,
                  lineHeight: 1.05,
                  letterSpacing: "-0.01em",
                  color: "rgba(0,0,0,0.86)",
                  margin: 0,
                }}>
                  Your session,<br />
                  <em style={{ fontStyle: "italic", color: "rgba(0,0,0,0.52)" }}>one place.</em>
                </h1>
                <p style={{
                  marginTop: "16px",
                  fontSize: "14px",
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: "rgba(0,0,0,0.62)",
                  maxWidth: "440px",
                }}>
                  Track progress, check the next milestone, and reach Chris directly — without digging through email threads.
                </p>
              </div>

              {/* Stat tiles */}
              <div className="grid gap-2 sm:grid-cols-3 lg:w-[320px] lg:shrink-0">
                <div className="pd-stat">
                  <div className="pd-mono" style={{ marginBottom: "10px" }}>Status</div>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "rgba(0,0,0,0.80)",
                    lineHeight: 1.3,
                  }}>
                    {activeStatusLabel}
                  </div>
                </div>
                <div className="pd-stat">
                  <div className="pd-mono" style={{ marginBottom: "10px" }}>Sessions</div>
                  <div style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "rgba(0,0,0,0.80)",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {sessions.length}
                  </div>
                </div>
                <div className="pd-stat">
                  <div className="pd-mono" style={{ marginBottom: "10px" }}>Delivered</div>
                  <div style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "rgba(0,0,0,0.80)",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {deliveredCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="pd-rule" style={{ marginTop: "28px", marginBottom: "20px" }} />

            {/* Bottom row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p style={{
                fontSize: "12px",
                color: "rgba(0,0,0,0.52)",
                lineHeight: 1.6,
                maxWidth: "380px",
                fontFamily: "'DM Mono', monospace",
                fontWeight: 400,
                letterSpacing: "0.04em",
              }}>
                Securely matched to your Google email. Only your linked sessions appear here.
              </p>
              <a
                href={contactChrisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pd-cta"
              >
                Compose email to Chris
              </a>
            </div>
          </div>
        </section>

        {/* ── Session cards or empty state ── */}
        {error ? (
          <div
            className="pd-panel pd-in"
            style={{ animationDelay: "120ms" }}
          >
            <div className="pd-panel-inner">
              <p style={{ fontSize: "13px", fontWeight: 600, color: C.danger }}>
                {error}
              </p>
            </div>
          </div>
        ) : sessions.length > 0 ? (
          <div className="flex flex-col gap-5">
            {sessions.map((session, index) => (
              <div
                key={session.id}
                className="pd-in"
                style={{ animationDelay: `${120 + index * 70}ms` }}
              >
                <SessionCard session={session} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="pd-panel pd-in"
            style={{ animationDelay: "120ms" }}
          >
            <div className="pd-panel-inner">
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "1.8rem",
                fontWeight: 400,
                color: "rgba(0,0,0,0.78)",
                margin: 0,
              }}>
                No linked session yet
              </h2>
              <p style={{
                marginTop: "12px",
                fontSize: "13px",
                color: "rgba(0,0,0,0.62)",
                lineHeight: 1.7,
                maxWidth: "400px",
              }}>
                No session is currently linked to this email. If you recently booked, your session may not be connected yet.
              </p>
              <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link href="/" className="pd-cta">Return to main site</Link>
                <a
                  href={contactChrisUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pd-pill"
                >
                  Email Chris
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
