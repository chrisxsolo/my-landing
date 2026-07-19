import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { ORIGINALS_BUCKET, isUuid } from "@/lib/contentEngine/uploadConfig";
import { MAX_DELETE_BATCH, deleteSessionPhotos } from "@/lib/contentEngine/deletePhotos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THUMBNAIL_TTL_SECONDS = 3600; // 1h signed reads (spec §4.1)

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const sessionId = (req.nextUrl.searchParams.get("sessionId") ?? "").toLowerCase();
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: photos, error } = await admin.from("session_photos")
    .select("id,storage_path,original_filename,width,height,sort_order,excluded,analysis_status,analysis_error,analysis_lease_expires_at,analysis_attempt,alt_text,title,description,tags,quality_score,suggested_category,destination_recommendations,public_derivative_url,created_at")
    .eq("photography_session_id", sessionId)
    .order("sort_order").order("created_at");
  if (error) {
    console.error("photo list failed", error);
    return NextResponse.json({ error: "could not list photos" }, { status: 500 });
  }

  const withThumbs = await Promise.all((photos ?? []).map(async (p) => {
    const { data } = await admin.storage.from(ORIGINALS_BUCKET)
      .createSignedUrl(p.storage_path as string, THUMBNAIL_TTL_SECONDS);
    return { ...p, thumbnailUrl: data?.signedUrl ?? null };
  }));
  return NextResponse.json({ photos: withThumbs });
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  const photoIds = body.photoIds;
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: "photoIds must be a non-empty array" }, { status: 422 });
  }
  if (photoIds.length > MAX_DELETE_BATCH) {
    return NextResponse.json({ error: `at most ${MAX_DELETE_BATCH} photos per delete` }, { status: 422 });
  }
  if (!photoIds.every((id): id is string => typeof id === "string" && isUuid(id))) {
    return NextResponse.json({ error: "photoIds must be uuids" }, { status: 422 });
  }

  try {
    const result = await deleteSessionPhotos(createSupabaseAdminClient(), sessionId, photoIds);
    return NextResponse.json(result);
  } catch (err) {
    console.error("photo delete failed", err);
    return NextResponse.json({ error: "could not delete photos" }, { status: 500 });
  }
}
