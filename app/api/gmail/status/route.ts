// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/gmail/status   — returns { connected, email? }
// DELETE /api/gmail/status — removes stored tokens (disconnect)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { getValidTokens } from "@/lib/gmailTokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    // getValidTokens() also auto-refreshes if expiring — so this is a real
    // liveness check, not just "does the DB key exist?"
    const tokens = await getValidTokens();
    if (!tokens) {
      // Tokens existed but can't be refreshed (revoked, expired, missing
      // refresh_token). Clean up the stale entry so the UI shows disconnected.
      const supabase = createSupabaseServerClient();
      await supabase.from("site_settings").delete().eq("key", "gmail_tokens");
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({ connected: true, email: tokens.email ?? "Gmail" });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  await supabase.from("site_settings").delete().eq("key", "gmail_tokens");
  return NextResponse.json({ ok: true });
}
