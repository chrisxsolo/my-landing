import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { addJournalPhotos, AddPhotosError } from "@/lib/contentEngine/addJournalPhotos";
import { getLiveJournalPhotos, JournalPhotosError, removeJournalPhoto } from "@/lib/contentEngine/liveJournalPhotos";
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
    revalidateJournal(result.slug);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "could not add photos");
  }
}

// Bust cached blog reads so the regenerated pages show the post's current photos.
function revalidateJournal(slug: string) {
  try {
    revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
  } catch (err) {
    console.error("tag revalidation failed (hourly ISR is the backstop)", err);
  }
  for (const path of ["/blog", `/blog/${slug}`]) {
    try {
      revalidatePath(path);
    } catch (err) {
      console.error(`revalidation failed for ${path} (hourly ISR is the backstop)`, err);
    }
  }
}

function errorResponse(err: unknown, fallback: string) {
  if (err instanceof AddPhotosError || err instanceof JournalPhotosError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(fallback, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// The photos the LIVE post shows (cover + gallery), each matched to its
// session photo when possible — the editor's view of a published journal.
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const itemId = (req.nextUrl.searchParams.get("itemId") ?? "").toLowerCase();
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });
  try {
    return NextResponse.json(await getLiveJournalPhotos(createSupabaseAdminClient(), itemId));
  } catch (err) {
    return errorResponse(err, "could not load the post's photos");
  }
}

// Removes ONE gallery photo from the live post (association only — the file
// and the session photo stay).
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: { itemId?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "string" ? body.itemId.toLowerCase() : "";
  if (!isUuid(itemId)) return NextResponse.json({ error: "itemId must be a uuid" }, { status: 400 });
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!/^https:\/\/\S+$/.test(url)) return NextResponse.json({ error: "url must be an https URL" }, { status: 400 });
  try {
    const result = await removeJournalPhoto(createSupabaseAdminClient(), itemId, url);
    revalidateJournal(result.slug);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "could not remove the photo");
  }
}
