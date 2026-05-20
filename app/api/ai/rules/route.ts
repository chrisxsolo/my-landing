// GET /api/ai/rules
// Returns the current Email Rules vault note so the admin can verify what Claude sees.
// Response: { content: string; updated_at: string | null; rule_count: number }

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const RULES_FOLDER = "09 AI Instructions";
const RULES_TITLE  = "Email Rules";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("id, content, updated_at")
    .eq("folder", RULES_FOLDER)
    .eq("title", RULES_TITLE)
    .single();

  if (error || !data) {
    return NextResponse.json({ content: "", updated_at: null, rule_count: 0 });
  }

  const lines = (data.content as string)
    .split("\n")
    .filter(l => l.trim().startsWith("- "));

  return NextResponse.json({
    content: data.content as string,
    updated_at: (data as Record<string, unknown>).updated_at as string | null ?? null,
    rule_count: lines.length,
  });
}
