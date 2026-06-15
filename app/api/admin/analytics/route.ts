// Admin API for link analytics (link_views, link_clicks). Both tables have RLS
// enabled with no anon policy — the public anon key cannot read these (they hold
// visitor user_ids / referrers / devices) or clear them. All access via service-role.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET: return views + clicks since ?since= (ISO timestamp) plus active links.
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const since = req.nextUrl.searchParams.get("since");
  if (!since || Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "A valid `since` ISO timestamp is required." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const [views, clicks, links] = await Promise.all([
      supabase.from("link_views").select("user_id,viewed_at,referrer,device").gte("viewed_at", since),
      supabase.from("link_clicks").select("link_id,user_id,clicked_at,referrer,device").gte("clicked_at", since),
      supabase.from("links").select("id,label,emoji,url").eq("active", true).order("order", { ascending: true }),
    ]);
    if (views.error) throw views.error;
    if (clicks.error) throw clicks.error;
    if (links.error) throw links.error;
    return NextResponse.json({
      views: views.data ?? [],
      clicks: clicks.data ?? [],
      links: links.data ?? [],
    });
  } catch (error) {
    console.error("[admin/analytics] GET failed:", error);
    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}

// DELETE: clear ALL analytics rows (views + clicks).
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const supabase = createSupabaseAdminClient();
    const [c, v] = await Promise.all([
      supabase.from("link_clicks").delete().neq("id", 0),
      supabase.from("link_views").delete().neq("id", 0),
    ]);
    if (c.error) throw c.error;
    if (v.error) throw v.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/analytics] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to clear analytics." }, { status: 500 });
  }
}
