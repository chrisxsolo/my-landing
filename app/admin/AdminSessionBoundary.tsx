"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { checkAuth, refreshAdminSession, useAdminAuthed } from "@/lib/adminAuth";
import { C } from "@/lib/colors";

const SESSION_CHECK_INTERVAL_MS = 60_000;

export default function AdminSessionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authed = useAdminAuthed();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function verify() {
      const wasAuthed = checkAuth();
      try {
        const valid = await refreshAdminSession();
        if (!active) return;
        setExpired(wasAuthed && !valid);
        setError("");
        setReady(true);
      } catch (cause) {
        console.error("[admin] session verification failed", cause);
        if (active) setError("Could not verify your session. Check your connection and retry.");
      }
    }
    void verify();
    window.addEventListener("focus", verify);
    const interval = window.setInterval(verify, SESSION_CHECK_INTERVAL_MS);
    return () => {
      active = false;
      window.removeEventListener("focus", verify);
      window.clearInterval(interval);
    };
  }, [pathname, retry]);

  useEffect(() => {
    if (ready && !authed && pathname !== "/admin") router.replace("/admin");
  }, [ready, authed, pathname, router]);

  const redirecting = ready && !authed && pathname !== "/admin";
  return <>
    {error && <div role="alert" className="p-4 text-center" style={{ background: C.dangerBg, color: C.danger }}>
      {error} <button className="underline font-semibold" onClick={() => setRetry(value => value + 1)}>Retry</button>
    </div>}
    {expired && !authed && <p role="alert" className="p-3 text-center" style={{ background: C.dangerBg, color: C.danger }}>
      Your session expired. Sign in again to continue.
    </p>}
    {ready && !redirecting ? children : !error && <p role="status" className="p-8 text-center">Checking admin session…</p>}
  </>;
}
