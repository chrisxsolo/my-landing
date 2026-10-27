// GET /api/admin/photo-distribution?key=<photo key>
//   → { photo, destinations, errors }: where one photo can appear on the public
//     site and why (lib/photoSync/distribution.ts). Read-only.
// requireAdmin + service role.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { loadPhotoDistribution } from "@/lib/photoSync/distributionLoad";
import { isPhotoKey } from "@/lib/photoTagging/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const key = req.nextUrl.searchParams.get("key");
  if (!isPhotoKey(key)) return NextResponse.json({ error: "key must be a photo key" }, { status: 400 });
  try {
    const result = await loadPhotoDistribution(createSupabaseAdminClient(), key);
    if (!result) return NextResponse.json({ error: "photo not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[photo-distribution] could not load", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "could not load the distribution" }, { status: 500 });
  }
}
