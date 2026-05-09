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
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at 50% 18%, black, transparent 72%);
        }

        .portal-orb {
          animation: portal-float 9s ease-in-out infinite;
          border-radius: 999px;
          filter: blur(2px);
          position: absolute;
        }

        .portal-orb-two { animation-delay: -3s; }

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

        @keyframes portal-rise {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes portal-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(18px, -22px, 0) scale(1.05); }
        }

        @media (prefers-reduced-motion: reduce) {
          .portal-orb, .portal-reveal {
            animation: none;
          }

          .portal-action:hover {
            transform: none;
          }
        }
      `}</style>

      <div className="portal-grid pointer-events-none absolute inset-0" />
      <div className="portal-orb left-[-120px] top-[-120px] h-72 w-72 opacity-80" style={{ background: C.blob1 }} />
      <div className="portal-orb portal-orb-two bottom-[-140px] right-[-100px] h-80 w-80 opacity-80" style={{ background: C.blob2 }} />

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
          className="portal-reveal mb-8 overflow-hidden rounded-[2rem] border p-6 md:p-8"
          style={{ animationDelay: "80ms", background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarmLg }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: C.p1 }}>
                Client portal
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight md:text-6xl" style={{ color: C.ink }}>
                Your photo session, beautifully tracked.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 md:text-lg" style={{ color: C.muted }}>
                Follow everything from your first inquiry through booking, session day, editing, final review, and gallery delivery.
              </p>
            </div>

            <div
              className="rounded-[1.5rem] border p-4 lg:min-w-72"
              style={{ background: C.surfaceWarm, borderColor: C.borderSubtle }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.p1 }}>
                Live session status
              </p>
              <p className="mt-2 text-sm font-bold leading-6" style={{ color: C.inkSoft }}>
                Securely matched to your Google email. Only your linked sessions show here.
              </p>
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
              <Link
                href="/contact"
                className="portal-action inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black"
                style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
              >
                Contact Chris
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
