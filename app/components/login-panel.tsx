"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import PortalStyleTag from "@/app/components/portal-style-tag";
import { G } from "@/lib/portalTheme";
import { supabase } from "@/lib/supabase";

type AuthMeResponse = {
  user?: { id: string; email: string | null };
  is_admin?: boolean;
  error?: string;
};

type EmailAuthMode = "signin" | "signup";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

const LOGIN_STYLES = `
  .lp-card {
    width: 100%;
    max-width: 420px;
    background: ${G.panel};
    border: 1px solid ${G.border};
    border-radius: 18px;
    box-shadow: ${G.shadowLift};
    padding: 32px 32px 36px;
    animation: lp-card-in 600ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
  }
  @keyframes lp-card-in {
    from { opacity: 0; transform: translateY(18px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .lp-pw-wrap { position: relative; width: 100%; }
  .lp-pw-wrap .gp-input { padding-right: 44px; }
  .lp-pw-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: ${G.inkFaint};
    display: flex;
    align-items: center;
    transition: color 160ms ease;
  }
  .lp-pw-toggle:hover { color: ${G.inkSoft}; }

  @media (prefers-reduced-motion: reduce) {
    .lp-card { animation: none !important; }
  }
  @media (max-width: 480px) {
    .lp-card { padding: 26px 22px 30px; }
  }
`;

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function LoginPanel() {
  const searchParams = useSearchParams();
  const nextPath = getSafeNext(searchParams.get("next"));
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signin");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  async function signOut() {
    await supabase.auth.signOut();
    setEmail(null);
    setIsAdmin(false);
  }

  async function provisionSession(token: string) {
    await fetch("/api/auth/provision-session", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (emailAuthMode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (emailAuthMode === "signup") {
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({ email: emailInput, password });
        if (signUpError) { setError(signUpError.message); return; }
        if (signUpData.session) {
          await provisionSession(signUpData.session.access_token);
          window.location.href = nextPath;
          return;
        }
        setSuccessMsg("Check your email to confirm your account, then sign in.");
        setEmailAuthMode("signin");
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({ email: emailInput, password });
        if (signInError) { setError(signInError.message); return; }
        if (signInData.session) {
          await provisionSession(signInData.session.access_token);
        }
        window.location.href = nextPath;
      }
    } finally {
      setSubmitting(false);
    }
  }

  const signup = emailAuthMode === "signup";

  return (
    <main className="gp-root flex min-h-screen items-center justify-center px-5 py-10">
      <PortalStyleTag />
      <style>{LOGIN_STYLES}</style>

      <div className="lp-card">

        {/* Brand row */}
        <div className="flex items-center justify-between">
          <Link href="/" className="gp-mono" style={{ color: G.accent, textDecoration: "none" }}>
            SoloXSnaps
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div className="gp-dot" />
            <span className="gp-mono">Secure</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="gp-display" style={{
          marginTop: "26px",
          marginBottom: 0,
          fontSize: "clamp(1.9rem, 5vw, 2.4rem)",
          lineHeight: 1.1,
        }}>
          {email ? "You're signed" : signup ? "Create your" : "Welcome"}<br />
          <em style={{ fontStyle: "italic", color: G.inkSoft }}>
            {email ? "in." : signup ? "account." : "back."}
          </em>
        </h1>
        <p style={{ marginTop: "12px", fontSize: "13px", lineHeight: 1.7, color: G.inkSoft, maxWidth: "300px" }}>
          {email
            ? "Head to your dashboard to follow your session."
            : "Sign in to follow your session from booking to gallery."}
        </p>

        <div className="gp-rule" style={{ margin: "24px 0" }} />

        {/* Auth area */}
        {loading ? (
          <div className="gp-skeleton" style={{ height: "46px", width: "100%" }} />
        ) : email ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="gp-tile">
              <div className="gp-mono" style={{ marginBottom: "5px" }}>Signed in as</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: G.inkSoft, wordBreak: "break-all" }}>
                {email}
              </div>
            </div>

            <Link href="/dashboard" className="gp-btn">Go to dashboard</Link>

            {isAdmin && (
              <Link href="/admin/sessions" className="gp-ghost">Open Portal Sessions</Link>
            )}

            <button type="button" onClick={signOut} className="gp-ghost">Sign out</button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              className="gp-input"
              type="email"
              placeholder="your@email.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="lp-pw-wrap">
              <input
                className="gp-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
              <button type="button" className="lp-pw-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon off={showPassword} />
              </button>
            </div>
            {signup && (
              <div className="lp-pw-wrap">
                <input
                  className="gp-input"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="lp-pw-toggle" onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                  <EyeIcon off={showConfirmPassword} />
                </button>
              </div>
            )}
            <button type="submit" className="gp-btn" disabled={submitting}>
              {submitting ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="gp-ghost"
              onClick={() => {
                setEmailAuthMode(signup ? "signin" : "signup");
                setError(null);
                setSuccessMsg(null);
                setConfirmPassword("");
              }}
            >
              {signup ? "Already have an account? Sign in" : "No account? Create one"}
            </button>
            {successMsg && (
              <p style={{ fontSize: "12px", fontWeight: 600, color: G.green, margin: 0, textAlign: "center" }}>
                {successMsg}
              </p>
            )}
            {error && (
              <p style={{ fontSize: "12px", fontWeight: 600, color: G.red, margin: 0 }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
