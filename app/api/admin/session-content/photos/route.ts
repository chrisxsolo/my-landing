import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { ORIGINALS_BUCKET, isUuid } from "@/lib/contentEngine/uploadConfig";

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
