// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/callback
//
// Google redirects here after the user approves (or denies) access.
// Exchanges the one-time code for access + refresh tokens, grabs the
// connected email address, stores everything in the dedicated, locked-down
// gmail_credentials table, then sends the user back to /admin?tab=inquiries.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getStoredRefreshToken, saveGmailTokens } from "@/lib/gmailTokens";
import { isValidAdminSession } from "@/lib/adminAuthShared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const siteUrl      = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const clientId     = process.env.GOOGLE_CLIENT_ID     ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri  = `${siteUrl}/api/gmail/callback`;

  // The consent flow is always started from /admin (gmail/auth is
  // requireAdmin-gated), so the redirect lands in the admin's own browser.
  // Without this check, anyone completing Google consent for their own
  // mailbox could overwrite the stored credentials — the state cookie alone
  // is no guard, since the requester controls it.
  const adminSession = req.cookies.get("admin_session")?.value;
  if (!isValidAdminSession(adminSession, process.env.ADMIN_SESSION_SECRET)) {
    return NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=error`);
  }

  const code        = req.nextUrl.searchParams.get("code");
  const error       = req.nextUrl.searchParams.get("error");
  const stateParam  = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("oauth_state")?.value;

  if (error || !code) {
    return NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=error`);
  }

  // Validate CSRF state — reject if missing or mismatched
  if (!stateParam || !storedState || stateParam !== storedState) {
    console.error("OAuth state mismatch — possible CSRF attack");
    return NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=error`);
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!tokens.access_token) {
    console.error("Gmail OAuth token error:", tokens.error);
    return NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=error`);
  }

  // ── Get the connected Gmail address ──────────────────────────────────────
  let email = "your Gmail";
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json() as { email?: string };
    if (user.email) email = user.email;
  } catch {
    // non-fatal — we still have the token
  }

  // ── Persist tokens (dedicated gmail_credentials table, service-role only) ──
  // Google only returns a refresh_token on first auth (or when prompt=consent).
  // If we somehow don't get one, preserve the existing one so we don't lose the
  // ability to auto-refresh.
  let refreshToken = tokens.refresh_token ?? null;
  if (!refreshToken) {
    try {
      refreshToken = await getStoredRefreshToken();
    } catch {
      // If we can't read the old token, proceed without it
    }
  }

  try {
    await saveGmailTokens({
      access_token:  tokens.access_token,
      refresh_token: refreshToken,
      expiry_date:   Date.now() + (tokens.expires_in ?? 3600) * 1000,
      email,
    });
  } catch (saveError) {
    console.error("Failed to save Gmail tokens:", saveError);
    return NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=error`);
  }

  const successRes = NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=connected`);
  // Clear the one-time state cookie
  successRes.cookies.set("oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });
  return successRes;
}
