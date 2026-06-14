// ─────────────────────────────────────────────────────────────────────────────
// Admin authentication helpers
//
// Real auth: httpOnly cookie set by POST /api/admin/login (server-side).
// localStorage flag: UI-only convenience — tells the browser it's already
// shown the authed state. Never used to gate API access.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";

const AUTH_KEY = "chris_admin_authed";

/** Client-side UI check only — not a security boundary */
export function checkAuth(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "true";
}

// The local auth flag never changes during a page's life (login/logout navigate
// away), so there is nothing to subscribe to.
const noopSubscribe = () => () => {};

/**
 * Hydration-safe read of the client auth flag. Returns false during SSR and the
 * first hydration render (matching server output), then the real value — without
 * a synchronous setState inside an effect.
 */
export function useAdminAuthed(): boolean {
  return useSyncExternalStore(noopSubscribe, checkAuth, () => false);
}

function setLocalAuth(authed: boolean) {
  if (typeof window === "undefined") return;
  if (authed) localStorage.setItem(AUTH_KEY, "true");
  else        localStorage.removeItem(AUTH_KEY);
}

/**
 * Verifies password server-side and sets the httpOnly session cookie.
 * Returns true on success, false on wrong password.
 */
export async function login(password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });
    if (res.ok) { setLocalAuth(true); return true; }
    return false;
  } catch {
    return false;
  }
}

/**
 * Clears both the server cookie and the localStorage flag.
 */
export async function logout(): Promise<void> {
  setLocalAuth(false);
  try { await fetch("/api/admin/login", { method: "DELETE" }); } catch { /* best-effort */ }
}
