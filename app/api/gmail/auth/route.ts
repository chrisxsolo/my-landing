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

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not configured." },
      { status: 503 }
    );
  }

  const redirectUri = `${siteUrl}/api/gmail/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt:      "consent", // always get a refresh token
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
