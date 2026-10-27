// GET /api/admin/content-health — the Content Engine dashboard's sync health
// card: photo sync runs, tagging gaps, empty campus spots, location drafts.
// requireAdmin + service role, read-only. Each part reports { ok: false,
// error } on its own failure, so the response itself is 200 unless auth fails.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { loadContentHealth } from "@/lib/contentHealth/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json(await loadContentHealth(createSupabaseAdminClient()));
  } catch (err) {
    console.error("[content-health] report failed", err);
    return NextResponse.json({ error: "could not build the content health report" }, { status: 500 });
  }
}
