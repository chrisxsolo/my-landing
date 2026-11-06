// GET: last worker heartbeat, overdue count, state counts, trigger status.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { loadPublishingHealth } from "@/lib/contentPublishing/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json(await loadPublishingHealth(createSupabaseAdminClient()));
  } catch (err) {
    console.error("[publication-schedules] health failed", err);
    return NextResponse.json({ error: "could not load publishing health" }, { status: 500 });
  }
}
