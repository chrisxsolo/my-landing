// ─────────────────────────────────────────────────────────────────────────────
// lib/gmailTokens.ts
//
// Loads Gmail OAuth tokens from the dedicated, locked-down `gmail_credentials`
// table (service-role only) and auto-refreshes when within 5 minutes of expiry.
//
// Tokens are NEVER stored in the general-purpose site_settings table and are
// only ever read/written here by the server-side service-role client. Callers
// (Gmail send/read routes) receive the token object server-side; it must never
// be returned in a browser-facing API response.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const GMAIL_CREDENTIALS_TABLE = "gmail_credentials";
const SINGLETON_ID = 1;

export type GmailTokens = {
  access_token:  string;
  refresh_token: string | null;
  expiry_date:   number;
  email:         string;
};

/** Read the current refresh token (or null). Server-side only. */
export async function getStoredRefreshToken(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from(GMAIL_CREDENTIALS_TABLE)
    .select("refresh_token")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  return data?.refresh_token ?? null;
}

/** Persist the connection (single row). Server-side only. */
export async function saveGmailTokens(tokens: GmailTokens): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.from(GMAIL_CREDENTIALS_TABLE).upsert(
    {
      id:            SINGLETON_ID,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date:   tokens.expiry_date,
      email:         tokens.email,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

/** Remove the stored connection (disconnect). Server-side only. */
export async function clearGmailTokens(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.from(GMAIL_CREDENTIALS_TABLE).delete().eq("id", SINGLETON_ID);
}

export async function getValidTokens(): Promise<GmailTokens | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from(GMAIL_CREDENTIALS_TABLE)
    .select("access_token,refresh_token,expiry_date,email")
    .eq("id", SINGLETON_ID)
    .maybeSingle();

  if (!data?.access_token) return null;

  let tokens: GmailTokens = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token ?? null,
    expiry_date:   Number(data.expiry_date ?? 0),
    email:         data.email ?? "Gmail",
  };

  // Refresh if expiring within 5 minutes.
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

    await saveGmailTokens(tokens);
  }

  return tokens;
}
