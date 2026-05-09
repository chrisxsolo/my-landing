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
    <main className="flex min-h-screen items-center justify-center px-5 py-10" style={{ background: C.page }}>
      <section
        className="w-full max-w-md rounded-xl border p-6 shadow-sm md:p-8"
        style={{ background: C.surfaceSoft, borderColor: C.borderWarm, boxShadow: C.shadowWarm }}
      >
        <Link href="/" className="text-sm font-black" style={{ color: C.p1 }}>
          SoloXSnaps
        </Link>
        <h1 className="mt-5 text-3xl font-black tracking-normal" style={{ color: C.ink }}>
          Client portal
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6" style={{ color: C.muted }}>
          Sign in with the Google account connected to your session to view your photo progress.
        </p>

        {loading ? (
          <div className="mt-7 h-12 animate-pulse rounded-lg" style={{ background: C.p1_08 }} />
        ) : email ? (
          <div className="mt-7 grid gap-3">
            <div className="rounded-lg border p-4" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
              <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                Signed in
              </div>
              <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>{email}</div>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-black"
              style={{ background: C.grad12, color: C.white }}
            >
              Go to dashboard
            </Link>

            {isAdmin && (
              <Link
                href="/admin/sessions"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border px-5 text-sm font-black"
                style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.inkSoft }}
              >
                Admin sessions
              </Link>
            )}

            <button
              type="button"
              onClick={signOut}
              className="min-h-11 rounded-lg border px-5 text-sm font-black"
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
              className="min-h-12 rounded-lg px-5 text-sm font-black"
              style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
            >
              Continue with Google
            </button>
            {error && <p className="text-sm font-bold" style={{ color: C.danger }}>{error}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
