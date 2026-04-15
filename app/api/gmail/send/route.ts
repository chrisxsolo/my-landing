// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gmail/send
//
// Sends an email via the authenticated Gmail account.
// Auto-refreshes the access token if it's about to expire.
//
// Request body:
//   { to: string, subject: string, body: string }
//
// Response:
//   { ok: true, messageId: string }  on success
//   { error: string }                on failure
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type GmailTokens = {
  access_token:  string;
  refresh_token: string | null;
  expiry_date:   number;
  email:         string;
};

// ── Load + auto-refresh tokens ────────────────────────────────────────────────
async function getValidTokens(): Promise<GmailTokens | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "gmail_tokens")
    .single();

  if (!data?.value) return null;

  let tokens: GmailTokens;
  try {
    tokens = JSON.parse(data.value);
  } catch {
    return null;
  }

  // Refresh if expiring within 5 minutes
  if (tokens.expiry_date < Date.now() + 5 * 60 * 1000) {
    if (!tokens.refresh_token) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID     ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: tokens.refresh_token,
        grant_type:    "refresh_token",
      }),
    });

    const refreshed = await res.json() as {
      access_token?: string;
      expires_in?: number;
    };
    if (!refreshed.access_token) return null;

    tokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expiry_date:  Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    };

    // Save refreshed token back to Supabase
    await supabase.from("site_settings").upsert(
      { key: "gmail_tokens", value: JSON.stringify(tokens), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  }

  return tokens;
}

// ── Build an RFC 2822 email and base64url-encode it ───────────────────────────
function buildRawMessage(from: string, to: string, subject: string, body: string): string {
  const lines = [
    `From: Chris Solorzano <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    body,
  ].join("\r\n");

  // btoa on a Unicode string requires percent-encoding first
  return btoa(unescape(encodeURIComponent(lines)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { to, subject, body: emailBody } = body;
  if (!to || !subject || !emailBody) {
    return NextResponse.json(
      { error: "to, subject, and body are required." },
      { status: 400 }
    );
  }

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json(
      { error: "Gmail is not connected. Click Connect Gmail in the admin dashboard." },
      { status: 401 }
    );
  }

  const raw = buildRawMessage(tokens.email, to, subject, emailBody);

  const gmailRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!gmailRes.ok) {
    const err = await gmailRes.json() as { error?: { message?: string } };
    const msg = err.error?.message ?? "Unknown Gmail API error";
    console.error("Gmail send error:", msg);
    return NextResponse.json({ error: `Send failed: ${msg}` }, { status: 500 });
  }

  const result = await gmailRes.json() as { id?: string };
  return NextResponse.json({ ok: true, messageId: result.id ?? "" });
}
