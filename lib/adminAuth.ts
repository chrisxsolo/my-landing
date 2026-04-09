// Shared admin authentication
export const ADMIN_PASSWORD = "chris2026";
const AUTH_KEY = "chris_admin_authed";

export function checkAuth(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function setAuth(authed: boolean) {
  if (typeof window === "undefined") return;
  if (authed) {
    localStorage.setItem(AUTH_KEY, "true");
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

export function logout() {
  setAuth(false);
}