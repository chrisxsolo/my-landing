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
    <main className="lp-root relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <style>{`
        /* ── Page background ── */
        .lp-root {
          background: #f5f5f7;
        }

        /* ── Soft gradient orbs ── */
        .lp-orb {
          border-radius: 999px;
          filter: blur(80px);
          position: absolute;
          pointer-events: none;
          animation: lp-drift 18s ease-in-out infinite;
        }
        .lp-orb-1 {
          width: 560px; height: 560px;
          top: -180px; left: -140px;
          background: rgba(157,111,232,0.10);
          animation-duration: 20s;
        }
        .lp-orb-2 {
          width: 420px; height: 420px;
          top: 10%; right: -120px;
          background: rgba(232,121,160,0.08);
          animation-duration: 16s;
          animation-delay: -6s;
        }
        .lp-orb-3 {
          width: 500px; height: 500px;
          bottom: -160px; left: 30%;
          background: rgba(157,111,232,0.07);
          animation-duration: 22s;
          animation-delay: -11s;
        }

        @keyframes lp-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -24px) scale(1.06); }
          66%       { transform: translate(-18px, 18px) scale(0.97); }
        }

        /* ── Subtle grid ── */
        .lp-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(157,111,232,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(157,111,232,0.045) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 40%, black, transparent);
        }

        /* ── Light sweep ── */
        .lp-sweep {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            115deg,
            transparent 0%,
            rgba(255,255,255,0.38) 48%,
            rgba(255,255,255,0.55) 50%,
            rgba(255,255,255,0.38) 52%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: lp-sweep 8s ease-in-out infinite;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        @keyframes lp-sweep {
          0%   { background-position: 200% 0; opacity: 0; }
          10%  { opacity: 1; }
          50%  { background-position: -40% 0; }
          60%  { opacity: 0; }
          100% { background-position: -40% 0; opacity: 0; }
        }

        /* ── Glass panel ── */
        .lp-panel {
          position: relative;
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 28px;
          box-shadow:
            0 2px 0 rgba(255,255,255,0.95) inset,
            0 0 0 0.5px rgba(0,0,0,0.06),
            0 24px 64px rgba(0,0,0,0.07),
            0 4px 16px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        /* Top specular line */
        .lp-panel::before {
          content: "";
          position: absolute;
          top: 0; left: 12%; right: 12%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,1) 60%, transparent);
          pointer-events: none;
        }

        /* Gradient accent top edge */
        .lp-panel::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(157,111,232,0.5), rgba(232,121,160,0.5), rgba(157,111,232,0.5));
          pointer-events: none;
        }

        /* ── Feature cards ── */
        .lp-card {
          background: rgba(255,255,255,0.60);
          border: 1px solid rgba(0,0,0,0.055);
          border-radius: 18px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: transform 200ms cubic-bezier(.25,.46,.45,.94),
                      box-shadow 200ms cubic-bezier(.25,.46,.45,.94),
                      border-color 200ms;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
        }
        .lp-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05);
          border-color: rgba(157,111,232,0.18);
        }

        /* ── CTA button ── */
        .lp-cta {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, ${C.p1}, ${C.p2});
          border-radius: 999px;
          transition: transform 180ms cubic-bezier(.25,.46,.45,.94),
                      box-shadow 180ms cubic-bezier(.25,.46,.45,.94),
                      opacity 180ms;
        }
        .lp-cta::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%);
          border-radius: inherit;
          pointer-events: none;
        }
        .lp-cta-sweep {
          position: absolute;
          top: 0; bottom: 0;
          width: 48px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
          animation: lp-cta-sweep 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes lp-cta-sweep {
          0%   { left: -60px; opacity: 0; }
          10%  { opacity: 1; }
          70%  { left: calc(100% + 60px); opacity: 1; }
          71%  { opacity: 0; }
          100% { left: calc(100% + 60px); opacity: 0; }
        }
        .lp-cta:hover {
          transform: translateY(-2px) scale(1.015);
          box-shadow: 0 12px 36px rgba(157,111,232,0.32), 0 4px 10px rgba(157,111,232,0.18);
          opacity: 0.96;
        }
        .lp-cta:active {
          transform: translateY(0) scale(0.99);
        }

        /* ── Secondary actions ── */
        .lp-action {
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 999px;
          transition: transform 180ms cubic-bezier(.25,.46,.45,.94),
                      box-shadow 180ms cubic-bezier(.25,.46,.45,.94);
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .lp-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.09);
        }

        /* ── Staggered entrance ── */
        .lp-in {
          animation: lp-rise 600ms cubic-bezier(.22,.68,0,1.2) both;
        }
        .lp-in-1 { animation-delay: 40ms; }
        .lp-in-2 { animation-delay: 100ms; }
        .lp-in-3 { animation-delay: 160ms; }
        .lp-in-4 { animation-delay: 220ms; }
        .lp-in-5 { animation-delay: 280ms; }
        .lp-in-6 { animation-delay: 340ms; }

        @keyframes lp-rise {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Kicker badge ── */
        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.80);
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6b7280;
          backdrop-filter: blur(12px);
        }
        .lp-badge-dot {
          width: 7px; height: 7px;
          border-radius: 999px;
          background: linear-gradient(135deg, ${C.p1}, ${C.p2});
          animation: lp-pulse 2.4s ease-in-out infinite;
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.8); }
        }

        /* ── Signed-in card ── */
        .lp-signed-card {
          background: rgba(255,255,255,0.65);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        /* ── Hint box ── */
        .lp-hint {
          background: rgba(255,255,255,0.52);
          border: 1px solid rgba(0,0,0,0.055);
          border-radius: 16px;
          backdrop-filter: blur(12px);
        }

        /* ── Pulse skeleton ── */
        .lp-skeleton {
          background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
          background-size: 200% 100%;
          animation: lp-shimmer 1.4s ease-in-out infinite;
          border-radius: 999px;
        }
        @keyframes lp-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-orb, .lp-sweep, .lp-cta-sweep, .lp-badge-dot,
          .lp-skeleton, .lp-in {
            animation: none !important;
          }
          .lp-cta:hover, .lp-action:hover, .lp-card:hover { transform: none; }
        }
      `}</style>

      {/* Background layers */}
      <div className="lp-grid" />
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <div className="lp-orb lp-orb-3" />

      <section className="lp-panel relative w-full max-w-xl p-7 md:p-10">
        <div className="lp-sweep" />

        {/* Kicker row */}
        <div className="lp-in lp-in-1 flex flex-wrap items-center gap-3">
          <Link href="/" className="text-sm font-black" style={{ color: C.p1 }}>
            SoloXSnaps
          </Link>
          <div className="lp-badge">
            <span className="lp-badge-dot" />
            Secure portal
          </div>
        </div>

        {/* Heading */}
        <h1
          className="lp-in lp-in-2 mt-6 text-[2.6rem] font-black leading-[0.92] tracking-[-0.03em] md:text-6xl"
          style={{ color: "#1a1a1a" }}
        >
          Client{" "}
          <span style={C.text12}>portal</span>
        </h1>

        <p
          className="lp-in lp-in-3 mt-4 max-w-md text-[0.94rem] leading-7 font-medium"
          style={{ color: "#6b7280" }}
        >
          Sign in with the Google account tied to your inquiry to unlock your session timeline and delivery updates.
        </p>

        {/* Feature cards */}
        <div className="lp-in lp-in-4 mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Timeline", body: "Inquiry to delivery in one view" },
            { label: "Login",    body: "Google email match keeps it simple" },
            { label: "Updates",  body: "Progress stays visible as your session moves forward" },
          ].map(({ label, body }) => (
            <div key={label} className="lp-card p-4">
              <p
                className="text-[10px] font-black uppercase tracking-[0.16em]"
                style={{ color: C.p1 }}
              >
                {label}
              </p>
              <p className="mt-2 text-sm font-semibold leading-5" style={{ color: "#1a1a1a" }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        {/* Auth area */}
        {loading ? (
          <div className="lp-skeleton mt-7 h-12 w-full" />
        ) : email ? (
          <div className="lp-in lp-in-5 mt-7 grid gap-3">
            <div className="lp-signed-card p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                Signed in
              </div>
              <div className="mt-1 break-words text-sm font-bold" style={{ color: "#1a1a1a" }}>
                {email}
              </div>
              <div
                className="lp-badge mt-3"
                style={{ fontSize: "10px" }}
              >
                <span className="lp-badge-dot" />
                Authenticated on this device
              </div>
            </div>

            <Link
              href="/dashboard"
              className="lp-cta inline-flex min-h-12 items-center justify-center px-5 text-sm font-black text-white"
            >
              <span className="lp-cta-sweep" />
              <span className="relative">Go to dashboard</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin/sessions"
                className="lp-action inline-flex min-h-12 items-center justify-center px-5 text-sm font-black"
                style={{ color: "#374151" }}
              >
                Open Portal Sessions
              </Link>
            )}

            <button
              type="button"
              onClick={signOut}
              className="lp-action min-h-11 px-5 text-sm font-bold"
              style={{ color: "#9ca3af" }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="lp-in lp-in-5 mt-7 grid gap-3">
            <button
              type="button"
              onClick={continueWithGoogle}
              className="lp-cta min-h-[52px] w-full px-5 text-sm font-black text-white"
            >
              <span className="lp-cta-sweep" />
              <span className="relative">Continue with Google</span>
            </button>

            <div className="lp-hint px-4 py-3 text-[11px] font-medium leading-5" style={{ color: "#9ca3af" }}>
              Access follows your Google email match, so your session details stay tied to the right inquiry.
            </div>

            {error && (
              <p className="text-sm font-bold" style={{ color: C.danger }}>
                {error}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
