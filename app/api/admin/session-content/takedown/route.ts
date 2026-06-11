import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { takedownPublishedItem, TakedownError } from "@/lib/contentEngine/takedown";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result = await takedownPublishedItem({
      client: createSupabaseAdminClient(),
      itemId,
      revalidate: (path) => revalidatePath(path),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TakedownError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("takedown failed unexpectedly", err);
    return NextResponse.json({ error: "takedown failed" }, { status: 500 });
  }
}
