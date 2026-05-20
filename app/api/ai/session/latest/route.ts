// GET /api/ai/session/latest
// Returns the most recent ai_training_sessions row so the chat UI can reload
// the last conversation on page mount.
// Response: { id: number; messages: {role:string;content:string}[] } | { id: null; messages: [] }

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_training_sessions")
    .select("id, messages")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ id: null, messages: [] });
  }

  return NextResponse.json({ id: data.id, messages: data.messages });
}
