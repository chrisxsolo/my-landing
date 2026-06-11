import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applyAutosave } from "@/lib/contentEngine/itemTransitions";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "item id must be a uuid" }, { status: 400 });

  let body: { payload?: unknown; payloadRevision?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const expectedRevision = typeof body.payloadRevision === "number" ? body.payloadRevision : -1;
  if (expectedRevision < 1) {
    return NextResponse.json({ error: "payloadRevision must be a positive integer" }, { status: 400 });
  }

  const result = await applyAutosave({
    client: createSupabaseAdminClient(),
    itemId: id.toLowerCase(),
    payload: body.payload,
    expectedRevision,
  });
  switch (result.outcome) {
    case "saved": return NextResponse.json(result);
    case "conflict": return NextResponse.json(result, { status: 409 });
    case "invalid": return NextResponse.json({ error: result.message }, { status: 422 });
    case "not_editable": return NextResponse.json({ error: `item is ${result.status}` }, { status: 409 });
    case "not_found": return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
}
