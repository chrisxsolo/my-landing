import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client.
// Uses the service role key when available — it bypasses Row Level Security
// and is never exposed to the browser. Falls back to the anon key for local
// dev if SUPABASE_SERVICE_ROLE_KEY isn't set yet (add it to Vercel env vars).
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      auth: {
        persistSession:   false,
        autoRefreshToken: false,
      },
    }
  );
}
