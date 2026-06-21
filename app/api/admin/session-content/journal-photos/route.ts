import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { addJournalPhotos, AddPhotosError } from "@/lib/contentEngine/addJournalPhotos";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { itemId?: unknown; photoIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });
  const photoIds = Array.isArray(body.photoIds)
    ? [...new Set(body.photoIds.filter((p): p is string => typeof p === "string" && isUuid(p.toLowerCase())).map((p) => p.toLowerCase()))]
    : [];
  if (photoIds.length === 0) {
    return NextResponse.json({ error: "photoIds must be a non-empty array of uuids" }, { status: 400 });
  }
  // Cap per request so derivative generation stays well under the function
  // timeout; the UI can add more in a second pass.
  if (photoIds.length > 12) {
    return NextResponse.json({ error: "add up to 12 photos at a time" }, { status: 400 });
  }

  try {
    const result = await addJournalPhotos({ client: createSupabaseAdminClient(), itemId, photoIds });
    for (const path of ["/blog", `/blog/${result.slug}`]) {
      try {
        revalidatePath(path);
      } catch (err) {
        console.error(`revalidation failed for ${path} (hourly ISR is the backstop)`, err);
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AddPhotosError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("add journal photos failed", err);
    return NextResponse.json({ error: "could not add photos" }, { status: 500 });
  }
}
