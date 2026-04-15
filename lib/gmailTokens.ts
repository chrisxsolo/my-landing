// ─────────────────────────────────────────────────────────────────────────────
// lib/gmailTokens.ts
//
// Shared helper: load Gmail OAuth tokens from site_settings and auto-refresh
// when they're within 5 minutes of expiry.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export type GmailTokens = {
  access_token:  string;
  refresh_token: string | null;
  expiry_date:   number;
  email:         string;
};

export async function getValidTokens(): Promise<GmailTokens | null> {
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

    const refreshed = await res.json() as { access_token?: string; expires_in?: number };
    if (!refreshed.access_token) return null;

    tokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expiry_date:  Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    };

    await supabase.from("site_settings").upsert(
      { key: "gmail_tokens", value: JSON.stringify(tokens), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  }

  return tokens;
}
