// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/callback
//
// Google redirects here after the user approves (or denies) access.
// Exchanges the one-time code for access + refresh tokens, grabs the
// connected email address, stores everything in site_settings, then
// sends the user back to /admin?tab=inquiries.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const siteUrl      = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const clientId     = process.env.GOOGLE_CLIENT_ID     ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri  = `${siteUrl}/api/gmail/callback`;

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

  // ── Persist tokens in Supabase ────────────────────────────────────────────
  const supabase = createSupabaseServerClient();

  // Google only returns a refresh_token on first auth (or when prompt=consent).
  // If we somehow don't get one, preserve the existing one from the DB so we
  // don't accidentally lose the ability to auto-refresh.
  let refreshToken = tokens.refresh_token ?? null;
  if (!refreshToken) {
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "gmail_tokens")
        .single();
      if (existing?.value) {
        const prev = JSON.parse(existing.value) as { refresh_token?: string };
        refreshToken = prev.refresh_token ?? null;
      }
    } catch {
      // If we can't read the old token, proceed without it
    }
  }

  const { error: upsertError } = await supabase.from("site_settings").upsert(
    {
      key: "gmail_tokens",
      value: JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: refreshToken,
        expiry_date:   Date.now() + (tokens.expires_in ?? 3600) * 1000,
        email,
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (upsertError) {
    console.error("Failed to save Gmail tokens to DB:", upsertError);
    return NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=error`);
  }

  const successRes = NextResponse.redirect(`${siteUrl}/admin?tab=inquiries&gmail=connected`);
  // Clear the one-time state cookie
  successRes.cookies.set("oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });
  return successRes;
}
