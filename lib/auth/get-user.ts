import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

let authClient: SupabaseClient | null = null;

function createSupabaseAuthClient() {
  if (authClient) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase auth client is not configured.");
  }

  authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return authClient;
}

export function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;

  return data.user;
}
