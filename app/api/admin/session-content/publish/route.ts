import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

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
      revalidate: (path) => {
        // Bust the cached blog reads first so the regenerated page sees the
        // new post instead of the hour-old data-cache entry.
        revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
        revalidatePath(path);
      },
    });
    if (outcome.status === "blocked") return NextResponse.json({ error: outcome.reason }, { status: 409 });
    if (outcome.status === "failed") return NextResponse.json({ error: outcome.error }, { status: 422 });
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("publish failed unexpectedly", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
