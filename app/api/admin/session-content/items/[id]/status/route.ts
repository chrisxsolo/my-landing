import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applyStatusAction, type StatusAction } from "@/lib/contentEngine/itemTransitions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: StatusAction[] = ["approve", "reject", "unreject"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "item id must be a uuid" }, { status: 400 });

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? (body.action as StatusAction) : ("" as StatusAction);
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
  }

  const result = await applyStatusAction({
    client: createSupabaseAdminClient(),
    itemId: id.toLowerCase(),
    action,
    reason: typeof body.reason === "string" ? body.reason : null,
  });
  switch (result.outcome) {
    case "done": return NextResponse.json(result);
    case "forbidden": return NextResponse.json({ error: result.message }, { status: 409 });
    case "not_found": return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
}
