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
  const deliveredCount = sessions.filter((session) => session.currentStatus === "delivered").length;
  const activeStatusLabel = primarySession ? CLIENT_SESSION_STATUS_LABELS[primarySession.currentStatus] : "No active session";

  if (loading) {
    return (
      <main className="min-h-screen px-5 py-10 md:px-8" style={{ background: "#f5f5f7" }}>
        <style>{`
          .portal-loading-card {
            position: relative;
            overflow: hidden;
            border-radius: 2rem;
          }
          .portal-loading-card::after {
            animation: portal-shimmer 1.6s ease-in-out infinite;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
            content: "";
            inset: 0;
            position: absolute;
            transform: translateX(-100%);
          }
          @keyframes portal-shimmer {
            100% { transform: translateX(100%); }
          }
        `}</style>
        <div className="mx-auto max-w-5xl">
          <div className="h-5 w-44 animate-pulse rounded-full" style={{ background: "rgba(157,111,232,0.10)" }} />
          <div className="portal-loading-card mt-8 h-96" style={{ background: "rgba(255,255,255,0.80)" }} />
        </div>
      </main>
    );
  }

  return (
    <main className="portal-root relative min-h-screen overflow-hidden px-5 py-8 md:px-8 md:py-10">
      <style>{`
        /* ── Root — pure white Apple canvas ── */
        .portal-root {
          background: #f5f5f7;
        }

        /* ── Ambient color washes — static, no animation, no blur filter ── */
        .portal-orb {
          border-radius: 999px;
          pointer-events: none;
          position: absolute;
        }
        .portal-orb-1 {
          width: 700px; height: 700px;
          top: -280px; left: -200px;
          background: radial-gradient(circle, rgba(157,111,232,0.10), transparent 68%);
        }
        .portal-orb-2 {
          width: 580px; height: 580px;
          top: 0; right: -180px;
          background: radial-gradient(circle, rgba(232,121,160,0.08), transparent 68%);
        }
        .portal-orb-3 {
          width: 500px; height: 500px;
          bottom: -160px; left: 25%;
          background: radial-gradient(circle, rgba(157,111,232,0.06), transparent 68%);
        }

        /* ── Subtle dot grid ── */
        .portal-grid {
          background-image: radial-gradient(circle, rgba(157,111,232,0.18) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 20%, black, transparent);
          pointer-events: none;
          position: absolute;
          inset: 0;
        }

        /* ── Entrance animation ── */
        .portal-reveal {
          animation: portal-rise 560ms cubic-bezier(0.22, 0.68, 0, 1.2) both;
        }
        @keyframes portal-rise {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Glass main panel ── */
        .portal-panel {
          position: relative;
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow:
            0 0 0 0.5px rgba(0,0,0,0.04),
            0 20px 60px rgba(0,0,0,0.06),
            0 4px 14px rgba(0,0,0,0.03);
        }
        /* Top specular highlight */
        .portal-panel::before {
          content: "";
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent);
          pointer-events: none;
          border-radius: inherit;
        }
        /* Gradient top edge */
        .portal-panel::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(157,111,232,0.55), rgba(232,121,160,0.55), rgba(157,111,232,0.45));
          border-radius: 2rem 2rem 0 0;
          pointer-events: none;
        }
        .portal-panel-content { position: relative; z-index: 1; }

        /* ── Stat cards ── */
        .portal-stat {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.07);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
          transition: transform 200ms cubic-bezier(0.25,0.46,0.45,0.94),
                      box-shadow 200ms cubic-bezier(0.25,0.46,0.45,0.94),
                      border-color 200ms;
        }
        .portal-stat:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05);
          border-color: rgba(157,111,232,0.18);
        }

        /* ── Note / quick-action sub-cards ── */
        .portal-subcard {
          background: #f9fafb;
          border: 1px solid rgba(0,0,0,0.07);
        }

        /* ── Live sync badge pulse ── */
        .portal-signal {
          animation: portal-pulse 2.4s ease-in-out infinite;
        }
        @keyframes portal-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,121,160,0.35); }
          50%       { box-shadow: 0 0 0 7px rgba(232,121,160,0); }
        }

        /* ── Gradient CTA button ── */
        .portal-cta {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #9d6fe8, #e879a0);
          border-radius: 999px;
          transition: transform 180ms cubic-bezier(0.25,0.46,0.45,0.94),
                      box-shadow 180ms cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .portal-cta::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 60%);
          border-radius: inherit;
          pointer-events: none;
        }
        .portal-cta-sweep {
          position: absolute;
          top: 0; bottom: 0;
          width: 44px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.26), transparent);
          animation: portal-sweep 3s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes portal-sweep {
          0%   { left: -60px; opacity: 0; }
          10%  { opacity: 1; }
          70%  { left: calc(100% + 60px); opacity: 1; }
          71%  { opacity: 0; }
          100% { left: calc(100% + 60px); opacity: 0; }
        }
        .portal-cta:hover {
          transform: translateY(-2px) scale(1.012);
          box-shadow: 0 12px 32px rgba(157,111,232,0.34), 0 4px 10px rgba(157,111,232,0.18);
        }
        .portal-cta:active { transform: translateY(0) scale(0.99); }

        /* ── Ghost pill buttons (nav) ── */
        .portal-action {
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          transition: transform 180ms cubic-bezier(0.25,0.46,0.45,0.94),
                      box-shadow 180ms cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .portal-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.09);
        }

        /* ── Empty / error card ── */
        .portal-empty {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 8px 32px rgba(0,0,0,0.05);
        }

        @media (prefers-reduced-motion: reduce) {
          .portal-orb, .portal-reveal, .portal-signal, .portal-cta-sweep { animation: none !important; }
          .portal-stat:hover, .portal-action:hover, .portal-cta:hover { transform: none; }
        }
      `}</style>

      {/* Background layers */}
      <div className="portal-grid" />
      <div className="portal-orb portal-orb-1" />
      <div className="portal-orb portal-orb-2" />
      <div className="portal-orb portal-orb-3" />

      <div className="relative mx-auto max-w-6xl">
        <header className="portal-reveal mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="portal-action inline-flex min-h-11 w-fit items-center justify-center rounded-full border px-4 text-sm font-black"
            style={{ color: "#1a1a1a" }}
          >
            Back to soloxsnaps.com
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {email && (
              <div
                className="portal-action rounded-full border px-4 py-2 text-xs font-black"
                style={{ color: "#6b7280" }}
              >
                Signed in as {email}
              </div>
            )}
            <a
              href={contactChrisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
              style={{ color: "#1a1a1a" }}
            >
              Email Chris
            </a>
            <button
              type="button"
              onClick={signOut}
              className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
              style={{ color: "#1a1a1a" }}
            >
              Sign out
            </button>
          </div>
        </header>

        <section
          className="portal-panel portal-reveal mb-8 overflow-hidden rounded-[2rem] p-6 md:p-8"
          style={{ animationDelay: "80ms" }}
        >
          <div className="portal-panel-content">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: C.p1 }}>
                    Client portal
                  </p>
                  <span
                    className="portal-signal inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                    style={{ background: "rgba(255,255,255,0.80)", borderColor: "rgba(0,0,0,0.07)", color: "#374151" }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.grad23 }} />
                    Live sync
                  </span>
                </div>
                <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.9] tracking-tight md:text-6xl" style={C.text12}>
                  Your session, in one polished timeline.
                </h1>
                <p className="mt-5 max-w-2xl text-base font-semibold leading-7 md:text-lg" style={{ color: "#4b5563" }}>
                  A cleaner control room for your photo session. Track progress, check the next milestone, and reach out directly without digging through long email threads.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem]">
                <div className="portal-stat rounded-[1.35rem] border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                    Active status
                  </p>
                  <p className="mt-3 text-lg font-black leading-tight" style={{ color: "#0e1412" }}>
                    {activeStatusLabel}
                  </p>
                </div>
                <div className="portal-stat rounded-[1.35rem] border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                    Sessions
                  </p>
                  <p className="mt-3 text-3xl font-black leading-none" style={{ color: "#0e1412" }}>
                    {sessions.length}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "#9ca3af" }}>
                    Linked to this login
                  </p>
                </div>
                <div className="portal-stat rounded-[1.35rem] border p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                    Delivered
                  </p>
                  <p className="mt-3 text-3xl font-black leading-none" style={{ color: "#0e1412" }}>
                    {deliveredCount}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "#9ca3af" }}>
                    Gallery complete
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
              <div className="portal-subcard rounded-[1.45rem] border px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.p1 }}>
                  Portal notes
                </p>
                <p className="mt-2 text-sm font-bold leading-6" style={{ color: "#4b5563" }}>
                  Securely matched to your Google email. Only your linked sessions show here, and your timeline updates as your booking moves from inquiry to delivery.
                </p>
              </div>
              <div className="portal-subcard rounded-[1.45rem] border px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.p1 }}>
                  Quick action
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row md:flex-col">
                  <a
                    href={contactChrisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-cta inline-flex min-h-11 items-center justify-center px-5 text-sm font-black text-white"
                  >
                    <span className="portal-cta-sweep" />
                    <span className="relative">Open Gmail compose</span>
                  </a>
                  <div className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: "#9ca3af" }}>
                    Replies go straight to Chris
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="portal-reveal portal-empty rounded-[1.5rem] border p-5">
            <p className="text-sm font-bold" style={{ color: C.danger }}>{error}</p>
          </div>
        ) : sessions.length > 0 ? (
          <div className="grid gap-5">
            {sessions.map((session, index) => (
              <div key={session.id} className="portal-reveal" style={{ animationDelay: `${160 + index * 90}ms` }}>
                <SessionCard session={session} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="portal-reveal portal-empty rounded-[2rem] border p-6 md:p-8"
            style={{ animationDelay: "160ms" }}
          >
            <h2 className="text-2xl font-black md:text-3xl" style={{ color: "#0e1412" }}>No linked session yet</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 md:text-base" style={{ color: "#6b7280" }}>
              No session is currently linked to this email. If you recently booked, your session may not be connected yet.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="portal-cta inline-flex min-h-11 items-center justify-center px-5 text-sm font-black text-white"
              >
                <span className="portal-cta-sweep" />
                <span className="relative">Return to main site</span>
              </Link>
              <a
                href={contactChrisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
                style={{ color: "#1a1a1a" }}
              >
                Email Chris
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
