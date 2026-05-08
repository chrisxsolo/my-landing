import { ADMIN_USERS_TABLE } from "@/lib/clientSessions";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function isAdminUser(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(ADMIN_USERS_TABLE)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[is-admin] admin lookup failed", error);
    return false;
  }

  return Boolean(data);
}
