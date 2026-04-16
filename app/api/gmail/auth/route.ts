// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/auth
//
// Kicks off the Google OAuth 2.0 flow. Redirects the browser to Google's
// consent screen requesting only the gmail.send scope (minimum permissions).
//
// Requires env vars:
//   GOOGLE_CLIENT_ID
//   NEXT_PUBLIC_SITE_URL  (e.g. https://soloxsnaps.com)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not configured." },
      { status: 503 }
    );
  }

  const redirectUri = `${siteUrl}/api/gmail/callback`;

  // Generate a random state value to prevent CSRF attacks on the OAuth callback
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt:      "consent", // always get a refresh token
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );

  // Store state in a short-lived httpOnly cookie — verified in the callback
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes — plenty of time to complete OAuth
    path:     "/",
  });

  return res;
}
