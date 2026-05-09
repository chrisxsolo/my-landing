"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { C } from "@/lib/colors";
import { supabase } from "@/lib/supabase";

type AuthMeResponse = {
  user?: { id: string; email: string | null };
  is_admin?: boolean;
  error?: string;
};

function getOAuthOrigin() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const browserOrigin = window.location.origin;
  const isLocal = browserOrigin.includes("localhost") || browserOrigin.includes("127.0.0.1");

  return isLocal ? browserOrigin : configuredSiteUrl || browserOrigin;
}

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function LoginPanel() {
  const searchParams = useSearchParams();
  const nextPath = getSafeNext(searchParams.get("next"));
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const token = session?.access_token;

      if (!token) {
        if (alive) setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as AuthMeResponse;

      if (!alive) return;
      setEmail(json.user?.email ?? session.user.email ?? null);
      setIsAdmin(Boolean(json.is_admin));
      setLoading(false);
    }

    loadSession().catch(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  async function continueWithGoogle() {
    setError(null);
    const redirectTo = `${getOAuthOrigin()}${nextPath}`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (signInError) setError(signInError.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEmail(null);
    setIsAdmin(false);
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10"
      style={{ background: `linear-gradient(135deg, ${C.page}, ${C.pageAlt})` }}
    >
      <style>{`
        .portal-login-grid {
          background-image: linear-gradient(${C.p1_06} 1px, transparent 1px), linear-gradient(90deg, ${C.p1_06} 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(circle at 50% 42%, black, transparent 78%);
        }

        .portal-login-orb {
          animation: portal-login-float 11s ease-in-out infinite;
          border-radius: 999px;
          filter: blur(12px);
          position: absolute;
        }

        .portal-login-panel {
          backdrop-filter: blur(18px);
          position: relative;
        }

        .portal-login-panel::before {
          background: linear-gradient(135deg, ${C.white_82}, transparent 46%);
          border-radius: inherit;
          content: "";
          inset: 1px;
          pointer-events: none;
          position: absolute;
        }

        .portal-login-content {
          position: relative;
          z-index: 1;
        }

        .portal-login-action {
          transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
        }

        .portal-login-action:hover {
          opacity: .94;
          transform: translateY(-2px);
        }

        @keyframes portal-login-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(24px, -18px, 0) scale(1.06); }
        }

        @media (prefers-reduced-motion: reduce) {
          .portal-login-orb {
            animation: none;
          }

          .portal-login-action:hover {
            transform: none;
          }
        }
      `}</style>

      <div className="portal-login-grid pointer-events-none absolute inset-0" />
      <div className="portal-login-orb left-[-8rem] top-[-6rem] h-72 w-72 opacity-80" style={{ background: C.blob1 }} />
      <div className="portal-login-orb bottom-[-9rem] right-[-6rem] h-80 w-80 opacity-75" style={{ background: C.blob2, animationDelay: "-4s" }} />

      <section
        className="portal-login-panel w-full max-w-lg overflow-hidden rounded-[2rem] border p-6 shadow-sm md:p-8"
        style={{ background: "rgba(255,251,247,0.74)", borderColor: C.borderWarm, boxShadow: C.shadowWarmLg }}
      >
        <div className="portal-login-content">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="text-sm font-black" style={{ color: C.p1 }}>
              SoloXSnaps
            </Link>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
              style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.grad23 }} />
              Secure portal
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-black leading-[0.92] tracking-tight md:text-5xl" style={C.text12}>
            Client portal
          </h1>
          <p className="mt-4 max-w-md text-sm font-semibold leading-7 md:text-base" style={{ color: C.inkSoft }}>
            Sign in with the Google account tied to your inquiry to unlock your session timeline, delivery updates, and direct contact with Chris.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                Timeline
              </p>
              <p className="mt-2 text-sm font-bold leading-5" style={{ color: C.ink }}>
                Inquiry to delivery in one view
              </p>
            </div>
            <div className="rounded-[1.2rem] border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                Login
              </p>
              <p className="mt-2 text-sm font-bold leading-5" style={{ color: C.ink }}>
                Google email match keeps it simple
              </p>
            </div>
            <div className="rounded-[1.2rem] border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
                Contact
              </p>
              <p className="mt-2 text-sm font-bold leading-5" style={{ color: C.ink }}>
                Reach Chris directly from the portal
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-7 h-12 animate-pulse rounded-2xl" style={{ background: C.p1_08 }} />
          ) : email ? (
            <div className="mt-7 grid gap-3">
              <div className="rounded-[1.3rem] border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                  Signed in
                </div>
                <div className="mt-1 break-words text-sm font-bold" style={{ color: C.ink }}>{email}</div>
              </div>

              <Link
                href="/dashboard"
                className="portal-login-action inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-black"
                style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
              >
                Go to dashboard
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/sessions"
                  className="portal-login-action inline-flex min-h-12 items-center justify-center rounded-full border px-5 text-sm font-black"
                  style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
                >
                  Admin sessions
                </Link>
              )}

              <button
                type="button"
                onClick={signOut}
                className="portal-login-action min-h-11 rounded-full border px-5 text-sm font-black"
                style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.muted }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={continueWithGoogle}
                className="portal-login-action min-h-12 rounded-full px-5 text-sm font-black"
                style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
              >
                Continue with Google
              </button>
              {error && <p className="text-sm font-bold" style={{ color: C.danger }}>{error}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
