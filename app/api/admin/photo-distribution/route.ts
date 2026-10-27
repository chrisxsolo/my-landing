// /api/admin/photo-distribution — "Where can / does this photo appear?"
//   GET  ?key=<photo key> | ?url=<photo url>
//        → { photo, destinations, placements, addOptions, errors }: where one
//          photo can appear (lib/photoSync/distribution.ts), every place it
//          does appear (lib/photoSync/placements.ts) and where it can be added.
//   POST { action: "remove" | "replace" | "add", target, url, newUrl?, newAlt? }
//        → edits ONE placement through the store that owns it
//          (lib/photoSync/placementActions.ts), then refreshes the public site.
// requireAdmin + service role.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { syncCampusSpotPhotosInBackground } from "@/lib/campusSpotFill/autoSync";
import { loadPhotoDistribution } from "@/lib/photoSync/distributionLoad";
import { applyPlacementEdit, PlacementActionError, type PlacementEdit } from "@/lib/photoSync/placementActions";
import { isPhotoKey } from "@/lib/photoTagging/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_URL = /^https:\/\//;
const EDIT_ACTIONS = new Set(["remove", "replace", "add"]);

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const key = req.nextUrl.searchParams.get("key");
  const url = req.nextUrl.searchParams.get("url");
  if (key !== null && !isPhotoKey(key)) return NextResponse.json({ error: "key must be a photo key" }, { status: 400 });
  if (key === null && !(url && PHOTO_URL.test(url))) return NextResponse.json({ error: "key or url is required" }, { status: 400 });
  try {
    const result = await loadPhotoDistribution(createSupabaseAdminClient(), { key, url });
    if (!result) return NextResponse.json({ error: "photo not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[photo-distribution] could not load", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "could not load the distribution" }, { status: 500 });
  }
}

function parseEdit(body: Record<string, unknown>): PlacementEdit | string {
  const { action, target, url, newUrl, newAlt } = body;
  if (typeof action !== "string" || !EDIT_ACTIONS.has(action)) return "action must be remove, replace or add";
  if (!target || typeof target !== "object" || typeof (target as { kind?: unknown }).kind !== "string") return "target is required";
  if (typeof url !== "string" || !PHOTO_URL.test(url)) return "url must be a photo URL";
  if (action === "replace") {
    if (typeof newUrl !== "string" || !PHOTO_URL.test(newUrl)) return "newUrl must be a photo URL";
    if (newAlt !== undefined && newAlt !== null && typeof newAlt !== "string") return "newAlt must be text";
    return { action, target: target as PlacementEdit["target"], url, newUrl, newAlt: typeof newAlt === "string" && newAlt.trim() ? newAlt.trim() : null } as PlacementEdit;
  }
  return { action, target, url } as PlacementEdit;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const edit = parseEdit(body ?? {});
  if (typeof edit === "string") return NextResponse.json({ error: edit }, { status: 400 });
  try {
    const message = await applyPlacementEdit(createSupabaseAdminClient(), edit);
    revalidatePublicContent();
    syncCampusSpotPhotosInBackground();
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    if (err instanceof PlacementActionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[photo-distribution] edit failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "could not edit the placement" }, { status: 500 });
  }
}
