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

const AUTH_CHANGED_EVENT = "admin-auth-changed";
let authRevision = 0;
let pendingAuthChanges = 0;

export function subscribeAdminAuth(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTH_KEY || event.key === null) {
      authRevision++;
      onChange();
    }
  };
  window.addEventListener(AUTH_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Hydration-safe UI state, updated on login, logout, and session expiry. */
export function useAdminAuthed(): boolean {
  return useSyncExternalStore(subscribeAdminAuth, checkAuth, () => false);
}

function setLocalAuth(authed: boolean) {
  if (typeof window === "undefined") return;
  authRevision++;
  const changed = checkAuth() !== authed;
  if (authed) localStorage.setItem(AUTH_KEY, "true");
  else localStorage.removeItem(AUTH_KEY);
  if (changed) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** Only a verified 401 expires a session; outages must not log users out. */
export async function refreshAdminSession(): Promise<boolean> {
  if (pendingAuthChanges > 0) return checkAuth();
  const revision = authRevision;
  const response = await fetch("/api/admin/login", { cache: "no-store" });
  if (!response.ok && response.status !== 401) throw new Error("Could not verify your admin session.");
  // An old request must never undo a newer login/logout in this or another tab.
  if (revision !== authRevision) return checkAuth();
  setLocalAuth(response.ok);
  return response.ok;
}

/**
 * Verifies password server-side and sets the httpOnly session cookie.
 * Returns true on success, false on wrong password.
 */
export async function login(password: string): Promise<boolean> {
  authRevision++;
  pendingAuthChanges++;
  try {
    const res = await fetch("/api/admin/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });
    if (res.ok) { setLocalAuth(true); return true; }
    return false;
  } catch (error) {
    console.error("[admin] login failed", error);
    return false;
  } finally {
    pendingAuthChanges--;
    authRevision++;
  }
}

/**
 * Clears both the server cookie and the localStorage flag.
 */
export async function logout(): Promise<void> {
  authRevision++;
  pendingAuthChanges++;
  try {
    const response = await fetch("/api/admin/login", { method: "DELETE" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    setLocalAuth(false);
  } finally {
    pendingAuthChanges--;
    authRevision++;
  }
}
