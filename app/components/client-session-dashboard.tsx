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
      <main className="min-h-screen px-5 py-10 md:px-8" style={{ background: C.page }}>
        <style>{`
          .portal-loading-card {
            position: relative;
            overflow: hidden;
          }

          .portal-loading-card::after {
            animation: portal-shimmer 1.4s ease-in-out infinite;
            background: linear-gradient(90deg, transparent, ${C.white_82}, transparent);
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
          <div className="h-6 w-44 animate-pulse rounded" style={{ background: C.p1_08 }} />
          <div className="portal-loading-card mt-8 h-96 rounded-[2rem]" style={{ background: C.surfaceStrong }} />
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden px-5 py-8 md:px-8 md:py-10"
      style={{ background: `linear-gradient(135deg, ${C.page}, ${C.pageAlt})` }}
    >
      <style>{`
        .portal-grid {
          background-image: linear-gradient(${C.p1_06} 1px, transparent 1px), linear-gradient(90deg, ${C.p1_06} 1px, transparent 1px);
          background-size: 38px 38px;
          mask-image: radial-gradient(circle at 50% 18%, black, transparent 74%);
        }

        .portal-orb {
          animation: portal-float 11s ease-in-out infinite;
          border-radius: 999px;
          filter: blur(8px);
          position: absolute;
        }

        .portal-orb-two { animation-delay: -3s; }
        .portal-orb-three { animation-delay: -6s; }

        .portal-beam {
          background: linear-gradient(180deg, ${C.p1_12}, transparent 60%);
          filter: blur(1px);
          opacity: .55;
          position: absolute;
          transform: rotate(16deg);
        }

        .portal-noise {
          background-image:
            radial-gradient(circle at 20% 20%, ${C.white_22} 0, transparent 24%),
            radial-gradient(circle at 80% 30%, ${C.p2_08} 0, transparent 18%),
            radial-gradient(circle at 60% 80%, ${C.p3_10} 0, transparent 22%);
          opacity: .65;
          pointer-events: none;
          position: absolute;
          inset: 0;
        }

        .portal-reveal {
          animation: portal-rise 620ms cubic-bezier(.2,.8,.2,1) both;
        }

        .portal-action {
          transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
        }

        .portal-action:hover {
          opacity: .92;
          transform: translateY(-2px);
        }

        .portal-panel {
          backdrop-filter: blur(18px);
          position: relative;
        }

        .portal-panel::before {
          background: linear-gradient(135deg, ${C.white_82}, transparent 45%, ${C.p1_06});
          content: "";
          inset: 1px;
          pointer-events: none;
          position: absolute;
          border-radius: inherit;
        }

        .portal-panel-content {
          position: relative;
          z-index: 1;
        }

        .portal-signal {
          animation: portal-pulse 2.4s ease-in-out infinite;
          box-shadow: 0 0 0 0 ${C.p2_18};
        }

        .portal-stat {
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .portal-stat:hover {
          transform: translateY(-2px);
        }

        @keyframes portal-rise {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes portal-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(18px, -22px, 0) scale(1.05); }
        }

        @keyframes portal-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${C.p2_18}; }
          50% { box-shadow: 0 0 0 8px transparent; }
        }

        @media (prefers-reduced-motion: reduce) {
          .portal-orb, .portal-reveal, .portal-signal {
            animation: none;
          }

          .portal-action:hover,
          .portal-stat:hover {
            transform: none;
          }
        }
      `}</style>

      <div className="portal-grid pointer-events-none absolute inset-0" />
      <div className="portal-noise" />
      <div className="portal-beam left-[6%] top-[-8%] h-[46vh] w-[22vw]" />
      <div className="portal-beam right-[12%] top-[14%] h-[38vh] w-[18vw]" style={{ transform: "rotate(-18deg)" }} />
      <div className="portal-orb left-[-120px] top-[-120px] h-72 w-72 opacity-80" style={{ background: C.blob1 }} />
      <div className="portal-orb portal-orb-two bottom-[-140px] right-[-100px] h-80 w-80 opacity-80" style={{ background: C.blob2 }} />
      <div className="portal-orb portal-orb-three left-[34%] top-[18%] h-64 w-64 opacity-50" style={{ background: C.blob3 }} />

      <div className="relative mx-auto max-w-6xl">
        <header className="portal-reveal mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="portal-action inline-flex min-h-11 w-fit items-center justify-center rounded-full border px-4 text-sm font-black"
            style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft, boxShadow: C.shadowWarmSm }}
          >
            Back to soloxsnaps.com
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {email && (
              <div
                className="rounded-full border px-4 py-2 text-xs font-black"
                style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.muted }}
              >
                Signed in as {email}
              </div>
            )}
            <a
              href={contactChrisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
              style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
            >
              Email Chris
            </a>
            <button
              type="button"
              onClick={signOut}
              className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
              style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
            >
              Sign out
            </button>
          </div>
        </header>

        <section
          className="portal-panel portal-reveal mb-8 overflow-hidden rounded-[2rem] border p-6 md:p-8"
          style={{ animationDelay: "80ms", background: "rgba(255,251,247,0.74)", borderColor: C.borderWarm, boxShadow: C.shadowWarmLg }}
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
                    style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.grad23 }} />
                    Live sync
                  </span>
                </div>
                <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.9] tracking-tight md:text-6xl" style={C.text12}>
                  Your session, in one polished timeline.
                </h1>
                <p className="mt-5 max-w-2xl text-base font-semibold leading-7 md:text-lg" style={{ color: C.inkSoft }}>
                  A cleaner control room for your photo session. Track progress, check the next milestone, and reach out directly without digging through long email threads.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem]">
                <div
                  className="portal-stat rounded-[1.35rem] border p-4"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, boxShadow: C.shadowWarmSm }}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                    Active status
                  </p>
                  <p className="mt-3 text-lg font-black leading-tight" style={{ color: C.ink }}>
                    {activeStatusLabel}
                  </p>
                </div>
                <div
                  className="portal-stat rounded-[1.35rem] border p-4"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, boxShadow: C.shadowWarmSm }}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                    Sessions
                  </p>
                  <p className="mt-3 text-3xl font-black leading-none" style={{ color: C.ink }}>
                    {sessions.length}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: C.mutedSoft }}>
                    Linked to this login
                  </p>
                </div>
                <div
                  className="portal-stat rounded-[1.35rem] border p-4"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, boxShadow: C.shadowWarmSm }}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                    Delivered
                  </p>
                  <p className="mt-3 text-3xl font-black leading-none" style={{ color: C.ink }}>
                    {deliveredCount}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: C.mutedSoft }}>
                    Gallery complete
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
              <div
                className="rounded-[1.45rem] border px-4 py-4"
                style={{ background: "rgba(255,255,255,0.62)", borderColor: C.borderSubtle }}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.p1 }}>
                  Portal notes
                </p>
                <p className="mt-2 text-sm font-bold leading-6" style={{ color: C.inkSoft }}>
                  Securely matched to your Google email. Only your linked sessions show here, and your timeline updates as your booking moves from inquiry to delivery.
                </p>
              </div>
              <div
                className="rounded-[1.45rem] border px-4 py-4"
                style={{ background: C.surfaceWarm, borderColor: C.borderSubtle }}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.p1 }}>
                  Quick action
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row md:flex-col">
                  <a
                    href={contactChrisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-action inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black"
                    style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
                  >
                    Open Gmail compose
                  </a>
                  <div className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: C.mutedSoft }}>
                    Replies go straight to Chris
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="portal-reveal rounded-[1.5rem] border p-5" style={{ background: C.surfaceStrong, borderColor: C.borderWarm }}>
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
            className="portal-reveal rounded-[2rem] border p-6 md:p-8"
            style={{ animationDelay: "160ms", background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarm }}
          >
            <h2 className="text-2xl font-black md:text-3xl" style={{ color: C.ink }}>No linked session yet</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 md:text-base" style={{ color: C.muted }}>
              No session is currently linked to this email. If you recently booked, your session may not be connected yet.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="portal-action inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black"
                style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
              >
                Return to main site
              </Link>
              <a
                href={contactChrisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
                style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
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
