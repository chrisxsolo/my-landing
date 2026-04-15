// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/gmail/status   — returns { connected, email? }
// DELETE /api/gmail/status — removes stored tokens (disconnect)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "gmail_tokens")
    .single();

  if (!data?.value) return NextResponse.json({ connected: false });

  try {
    const tokens = JSON.parse(data.value) as { email?: string };
    return NextResponse.json({ connected: true, email: tokens.email ?? "Gmail" });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  const supabase = createSupabaseServerClient();
  await supabase.from("site_settings").delete().eq("key", "gmail_tokens");
  return NextResponse.json({ ok: true });
}
