import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { revalidateOnePath } from "@/lib/contentPublishing/refresh";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { syncItemSessionInBackground } from "@/lib/locationLibrary/autoSync";
import { syncCampusSpotPhotosInBackground } from "@/lib/campusSpotFill/autoSync";
import { cancelActiveSchedulesForItem } from "@/lib/contentPublishing/scheduleService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { itemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });

  try {
    const outcome = await publishApprovedItem({
      client: createSupabaseAdminClient(),
      itemId,
      // Busts the cached blog reads first so the regenerated page sees the new
      // post, and revalidates dynamic patterns (category archives) as pages.
      revalidate: revalidateOnePath,
    });
    if (outcome.status === "blocked") return NextResponse.json({ error: outcome.reason }, { status: 409 });
    if (outcome.status === "failed") return NextResponse.json({ error: outcome.error }, { status: 422 });
    // Published directly: a schedule it still had would only block later.
    // Housekeeping only — the item IS live, so a failure here is logged, not answered.
    try {
      await cancelActiveSchedulesForItem(createSupabaseAdminClient(), itemId, "cancelled: published directly");
    } catch (err) {
      console.error(`could not cancel the schedule of directly published item ${itemId}`, err);
    }
    // A published photo can bring the session (and its place) into the location library.
    syncItemSessionInBackground(itemId);
    syncCampusSpotPhotosInBackground();
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("publish failed unexpectedly", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
