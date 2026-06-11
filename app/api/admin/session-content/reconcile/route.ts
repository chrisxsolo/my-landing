import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildReconcileReport, linkItemToExistingTarget, markStuckItemFailed,
} from "@/lib/contentEngine/reconcile";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  try {
    const report = await buildReconcileReport({ client: createSupabaseAdminClient(), sessionId });
    return NextResponse.json(report);
  } catch (err) {
    console.error("reconcile report failed", err);
    return NextResponse.json({ error: "could not build reconcile report" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });

  try {
    if (body.action === "link") {
      const result = await linkItemToExistingTarget({
        client: createSupabaseAdminClient(), itemId,
        targetType: typeof body.targetType === "string" ? body.targetType : "",
        targetId: typeof body.targetId === "string" ? body.targetId : "",
        confirm: body.confirm === true,
      });
      return NextResponse.json(result);
    }
    if (body.action === "mark_failed") {
      const result = await markStuckItemFailed({ client: createSupabaseAdminClient(), itemId });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "action must be 'link' or 'mark_failed'" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reconcile action failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
