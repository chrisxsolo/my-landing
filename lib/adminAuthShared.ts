// ─────────────────────────────────────────────────────────────────────────────
// lib/adminAuthShared.ts
//
// Pure admin-session predicate, extracted so the authorization decision is
// unit-testable without constructing an HTTP request. Used by requireAdmin().
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True only when a valid admin session cookie matches the configured secret.
 * Deny when the secret is unset, the cookie is missing, or they differ.
 */
export function isValidAdminSession(
  sessionCookie: string | undefined | null,
  secret: string | undefined | null,
): boolean {
  if (!secret) return false;
  if (!sessionCookie) return false;
  return sessionCookie === secret;
}
