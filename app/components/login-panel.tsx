"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";

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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Mono:wght@300;400;500&display=swap');

        .lp-root {
          background: #f8f7f5;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }


        /* ── Main card ── */
        .lp-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 448px;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 20px;
          box-shadow:
            0 0 0 0.5px rgba(0,0,0,0.04),
            0 2px 4px rgba(0,0,0,0.04),
            0 12px 40px rgba(0,0,0,0.08),
            0 32px 80px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        /* Top warm edge line */
        .lp-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(0,0,0,0.10) 30%,
            rgba(0,0,0,0.16) 50%,
            rgba(0,0,0,0.10) 70%,
            transparent 100%
          );
          pointer-events: none;
        }

        .lp-card-inner {
          position: relative;
          z-index: 1;
          padding: 36px 36px 40px;
        }

        /* ── Wordmark / brand ── */
        .lp-wordmark {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.55);
        }

        /* ── Divider ── */
        .lp-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.08) 30%, rgba(0,0,0,0.08) 70%, transparent);
          margin: 28px 0;
        }

        /* ── Status dot ── */
        .lp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4caf7d;
          box-shadow: 0 0 0 2px rgba(76,175,125,0.20);
          flex-shrink: 0;
        }

        /* ── Feature list ── */
        .lp-feature {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(0,0,0,0.055);
        }
        .lp-feature:last-child { border-bottom: none; }
        .lp-feature-num {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.1em;
          color: rgba(0,0,0,0.45);
          padding-top: 1px;
          min-width: 20px;
        }
        .lp-feature-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.55);
          margin-bottom: 2px;
        }
        .lp-feature-body {
          font-size: 13px;
          font-weight: 500;
          color: rgba(0,0,0,0.68);
          line-height: 1.5;
        }

        /* ── Google CTA ── */
        .lp-google-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 52px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.04);
          color: rgba(0,0,0,0.80);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition:
            background 180ms ease,
            border-color 180ms ease,
            transform 160ms ease;
        }
        .lp-google-btn:hover {
          background: rgba(0,0,0,0.07);
          border-color: rgba(0,0,0,0.18);
          transform: translateY(-1px);
        }
        .lp-google-btn:active {
          transform: translateY(0);
          background: rgba(0,0,0,0.05);
        }

        /* ── Dashboard link ── */
        .lp-dash-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 52px;
          border-radius: 12px;
          background: #111110;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          text-decoration: none;
          transition:
            background 180ms ease,
            transform 160ms ease;
        }
        .lp-dash-btn:hover {
          background: #1e1d1b;
          transform: translateY(-1px);
        }
        .lp-dash-btn:active {
          transform: translateY(0);
        }

        /* ── Ghost btn ── */
        .lp-ghost-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 40px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.12);
          background: transparent;
          color: rgba(0,0,0,0.55);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          cursor: pointer;
          text-decoration: none;
          transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
        }
        .lp-ghost-btn:hover {
          color: rgba(0,0,0,0.75);
          border-color: rgba(0,0,0,0.20);
          background: rgba(0,0,0,0.03);
        }

        /* ── Signed-in email block ── */
        .lp-email-block {
          background: rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 10px;
          padding: 14px 16px;
        }

        /* ── Hint text ── */
        .lp-hint {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: rgba(0,0,0,0.50);
          line-height: 1.7;
          text-align: center;
        }

        /* ── Skeleton ── */
        .lp-skeleton {
          border-radius: 12px;
          background: rgba(0,0,0,0.06);
          animation: lp-pulse 1.8s ease-in-out infinite;
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* ── Entrance ── */
        .lp-fade {
          animation: lp-up 500ms cubic-bezier(0.22, 0.68, 0, 1.1) both;
        }
        .lp-fade-1 { animation-delay: 0ms; }
        .lp-fade-2 { animation-delay: 60ms; }
        .lp-fade-3 { animation-delay: 120ms; }
        .lp-fade-4 { animation-delay: 180ms; }
        @keyframes lp-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-fade, .lp-skeleton { animation: none; }
          .lp-google-btn:hover, .lp-dash-btn:hover { transform: none; }
        }

        @media (max-width: 480px) {
          .lp-card-inner { padding: 28px 24px 32px; }
        }
      `}</style>

      <div className="lp-card lp-fade lp-fade-1">
        <div className="lp-card-inner">

          {/* Brand row */}
          <div className="lp-fade lp-fade-1 flex items-center justify-between">
            <Link href="/" className="lp-wordmark hover:opacity-50 transition-opacity">
              SoloXSnaps
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div className="lp-dot" />
              <span className="lp-wordmark" style={{ color: "rgba(0,0,0,0.45)" }}>
                Secure
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="lp-fade lp-fade-2" style={{ marginTop: "32px" }}>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              color: "rgba(0,0,0,0.88)",
              margin: 0,
            }}>
              Client<br />
              <em style={{ fontStyle: "italic", color: "rgba(0,0,0,0.52)" }}>portal</em>
            </h1>
            <p style={{
              marginTop: "14px",
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: 1.7,
              color: "rgba(0,0,0,0.60)",
              maxWidth: "320px",
            }}>
              Sign in with the Google account tied to your inquiry to access your session timeline.
            </p>
          </div>

          <div className="lp-divider" />

          {/* Feature list */}
          <div className="lp-fade lp-fade-3">
            {[
              { num: "01", label: "Timeline", body: "Inquiry through delivery in one view" },
              { num: "02", label: "Access", body: "Matched to your Google email automatically" },
              { num: "03", label: "Updates", body: "Progress syncs as your session moves forward" },
            ].map(({ num, label, body }) => (
              <div key={num} className="lp-feature">
                <span className="lp-feature-num">{num}</span>
                <div>
                  <div className="lp-feature-label">{label}</div>
                  <div className="lp-feature-body">{body}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-divider" />

          {/* Auth area */}
          <div className="lp-fade lp-fade-4">
            {loading ? (
              <div className="lp-skeleton" style={{ height: "52px", width: "100%" }} />
            ) : email ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="lp-email-block">
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "10px",
                    fontWeight: 400,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(0,0,0,0.52)",
                    marginBottom: "6px",
                  }}>
                    Signed in as
                  </div>
                  <div style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "rgba(0,0,0,0.72)",
                    wordBreak: "break-all",
                  }}>
                    {email}
                  </div>
                </div>

                <Link href="/dashboard" className="lp-dash-btn">
                  Go to dashboard
                </Link>

                {isAdmin && (
                  <Link href="/admin/sessions" className="lp-ghost-btn">
                    Open Portal Sessions
                  </Link>
                )}

                <button type="button" onClick={signOut} className="lp-ghost-btn">
                  Sign out
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button type="button" onClick={continueWithGoogle} className="lp-google-btn">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="rgba(0,0,0,0.55)"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="rgba(0,0,0,0.45)"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="rgba(0,0,0,0.38)"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="rgba(0,0,0,0.50)"/>
                  </svg>
                  Continue with Google
                </button>

                {error && (
                  <p style={{ fontSize: "12px", fontWeight: 600, color: C.danger, margin: 0 }}>
                    {error}
                  </p>
                )}

                <p className="lp-hint" style={{ marginTop: "4px" }}>
                  Access is matched to your Google email — no password needed.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
