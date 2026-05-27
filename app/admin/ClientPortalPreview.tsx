"use client";

import { useEffect, useState } from "react";
import SessionCard from "@/app/components/session-card";
import {
  CLIENT_SESSION_STATUS_LABELS,
  type AdminClientSessionDTO,
} from "@/lib/clientSessions";

type Props = {
  email: string;
  onClose: () => void;
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

  .pd-mono {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: rgba(0,0,0,0.52);
  }

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

  .pd-stat {
    background: rgba(0,0,0,0.03);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 14px;
    padding: 20px;
    transition: border-color 200ms ease, background 200ms ease;
  }
  .pd-stat:hover {
    border-color: rgba(0,0,0,0.14);
    background: rgba(0,0,0,0.05);
  }

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
    white-space: nowrap;
  }

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
    white-space: nowrap;
  }

  .pd-rule {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,0.08) 20%, rgba(0,0,0,0.08) 80%, transparent);
  }

  .pd-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4caf7d;
    box-shadow: 0 0 0 2px rgba(76,175,125,0.20);
    flex-shrink: 0;
  }

  .pd-in {
    animation: pd-up 480ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
  }
  @keyframes pd-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .pd-skeleton {
    background: rgba(0,0,0,0.06);
    border-radius: 14px;
    animation: pd-pulse 1.8s ease-in-out infinite;
  }
  @keyframes pd-pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
`;

export default function ClientPortalPreview({ email, onClose }: Props) {
  const [sessions, setSessions] = useState<AdminClientSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/sessions")
      .then(r => r.json())
      .then(json => {
        const all: AdminClientSessionDTO[] = json.sessions ?? [];
        setSessions(all.filter(s => s.clientEmail.toLowerCase() === email.toLowerCase()));
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [email]);

  const primarySession = sessions[0] ?? null;
  const deliveredCount = sessions.filter(s => s.currentStatus === "delivered").length;
  const activeStatusLabel = primarySession
    ? CLIENT_SESSION_STATUS_LABELS[primarySession.currentStatus]
    : "No active session";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, overflowY: "auto" }}>
      {/* Admin preview banner */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#1e293b",
        color: "#fff",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: "#f59e0b",
            color: "#1e293b",
            borderRadius: 4,
            padding: "2px 7px",
          }}>
            Admin Preview
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
            Client view for <strong style={{ color: "#fff" }}>{email}</strong>
          </span>
          {!loading && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              — {sessions.length} session{sessions.length !== 1 ? "s" : ""} linked
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            background: "none",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 8,
            padding: "5px 14px",
            cursor: "pointer",
          }}
        >
          ✕ Close Preview
        </button>
      </div>

      <style>{SHARED_STYLES}</style>

      <main className="pd-root px-5 py-8 md:px-8 md:py-10">
        {loading ? (
          <div className="relative z-10 mx-auto max-w-5xl">
            <div className="pd-skeleton mb-6" style={{ height: 36, width: 192 }} />
            <div className="pd-skeleton" style={{ height: 256, width: "100%" }} />
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-5xl">

            {/* Top nav (read-only replica) */}
            <header className="pd-in mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: "0ms" }}>
              <button type="button" onClick={onClose} className="pd-pill" style={{ cursor: "pointer" }}>← Back to accounts</button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="pd-mono" style={{ marginRight: 4 }}>{email}</span>
                <span className="pd-pill" style={{ cursor: "default", opacity: 0.6 }}>Email Chris</span>
                <span className="pd-pill" style={{ cursor: "default", opacity: 0.6 }}>Sign out</span>
              </div>
            </header>

            {/* Hero panel */}
            <section className="pd-panel pd-in mb-6" style={{ animationDelay: "60ms" }}>
              <div className="pd-panel-inner">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <span className="pd-mono">Client portal</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="pd-dot" />
                    <span className="pd-mono" style={{ color: "rgba(0,0,0,0.45)" }}>Live</span>
                  </div>
                </div>

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
                      marginTop: 16,
                      fontSize: 14,
                      fontWeight: 400,
                      lineHeight: 1.7,
                      color: "rgba(0,0,0,0.62)",
                      maxWidth: 440,
                    }}>
                      Track progress, check the next milestone, and reach Chris directly — without digging through email threads.
                    </p>
                  </div>

                  {/* Stat tiles */}
                  <div className="grid gap-2 sm:grid-cols-3 lg:w-[320px] lg:shrink-0">
                    <div className="pd-stat">
                      <div className="pd-mono" style={{ marginBottom: 10 }}>Status</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.80)", lineHeight: 1.3 }}>
                        {activeStatusLabel}
                      </div>
                    </div>
                    <div className="pd-stat">
                      <div className="pd-mono" style={{ marginBottom: 10 }}>Sessions</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(0,0,0,0.80)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                        {sessions.length}
                      </div>
                    </div>
                    <div className="pd-stat">
                      <div className="pd-mono" style={{ marginBottom: 10 }}>Delivered</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(0,0,0,0.80)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                        {deliveredCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pd-rule" style={{ marginTop: 28, marginBottom: 20 }} />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p style={{
                    fontSize: 12,
                    color: "rgba(0,0,0,0.52)",
                    lineHeight: 1.6,
                    maxWidth: 380,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 400,
                    letterSpacing: "0.04em",
                  }}>
                    Securely matched to your Google email. Only your linked sessions appear here.
                  </p>
                  <span className="pd-cta" style={{ cursor: "default", opacity: 0.7 }}>
                    Compose email to Chris
                  </span>
                </div>
              </div>
            </section>

            {/* Session cards or empty state */}
            {sessions.length > 0 ? (
              <div className="flex flex-col gap-5">
                {sessions.map((session, index) => (
                  <div key={session.id} className="pd-in" style={{ animationDelay: `${120 + index * 70}ms` }}>
                    <SessionCard session={session} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="pd-panel pd-in" style={{ animationDelay: "120ms" }}>
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
                    marginTop: 12,
                    fontSize: 13,
                    color: "rgba(0,0,0,0.62)",
                    lineHeight: 1.7,
                    maxWidth: 400,
                  }}>
                    No session is currently linked to this email. If you recently booked, your session may not be connected yet.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
