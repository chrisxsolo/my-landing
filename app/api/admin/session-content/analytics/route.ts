import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("content_events")
    .select("event_type,content_item_id")
    .eq("photography_session_id", sessionId);
  if (error) {
    console.error("analytics query failed", error);
    return NextResponse.json({ error: "could not load analytics" }, { status: 500 });
  }

  const perItem: Record<string, number> = {};
  let views = 0;
  let ctaClicks = 0;
  for (const row of data ?? []) {
    if (row.event_type === "page_view") {
      views += 1;
      if (row.content_item_id) {
        perItem[row.content_item_id] = (perItem[row.content_item_id] ?? 0) + 1;
      }
    } else if (row.event_type === "cta_click") {
      ctaClicks += 1;
    }
  }
  return NextResponse.json({ views, ctaClicks, perItem });
}
