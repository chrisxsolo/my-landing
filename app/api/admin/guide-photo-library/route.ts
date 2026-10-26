// Admin API for the "Choose existing photo" picker, shared by every location
// guide (couples / family / portrait galleries) and the grad campus spots.
//
// GET   browse the Content Engine library, ranked for one target.
// POST  action "approve": build the photo's public web copy (the same single
//         derivative the engine makes on publish) and return its URL.
//       action "attach": link the photo to a guide gallery via the
//         attach_existing_guide_photo RPC — reuses the web copy, never copies
//         the file, reuses an existing gallery row for the same image, and
//         (for "hero") publishes it and moves the hero in one statement.
// Every method is requireAdmin + service role.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { ensureDerivativesForPhotos } from "@/lib/contentEngine/derivatives";
import { PUBLIC_CONTENT_CACHE_TAG } from "@/lib/publicContentCache";
import { isGuideTarget, locationOptions, rankLibrary, type LibraryFilters, type LibraryTarget } from "@/lib/guidePhotoLibrary/rank";
import { engineSchoolForSpot, isValidGuideSlug, loadLibrary, toPickerPhotos } from "@/lib/guidePhotoLibrary/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // building a web copy downloads + resizes the original

const PAGE_SIZE = 48;

class BadRequest extends Error {}

function jsonError(error: unknown, fallback: string) {
  const status = error instanceof BadRequest ? 400 : 500;
  if (status === 500) console.error(`[admin/guide-photo-library] ${fallback}`, error);
  const message = error instanceof Error && error.message ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

function parseTarget(params: { guide?: unknown; slug?: unknown; spotSchool?: unknown }): LibraryTarget {
  if (typeof params.spotSchool === "string" && params.spotSchool) {
    return { kind: "gradSpot", spotSchoolId: params.spotSchool };
  }
  if (!isGuideTarget(params.guide)) throw new BadRequest("Unknown guide.");
  if (!isValidGuideSlug(params.guide, params.slug)) throw new BadRequest("Unknown guide location.");
  return { kind: "guide", guide: params.guide, slug: params.slug as string };
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const sp = req.nextUrl.searchParams;
    const target = parseTarget({ guide: sp.get("guide"), slug: sp.get("slug"), spotSchool: sp.get("spotSchool") });
    const filters: LibraryFilters = {
      q: sp.get("q") ?? undefined,
      location: sp.get("location") || undefined,
      category: sp.get("category") || undefined,
      scope: sp.get("scope") === "all" ? "all" : "suggested",
    };
    const page = Math.max(0, Number.parseInt(sp.get("page") ?? "0", 10) || 0);

    const client = createSupabaseAdminClient();
    const lib = await loadLibrary(client, target);
    const spotSchool = target.kind === "gradSpot" ? engineSchoolForSpot(target.spotSchoolId) : null;
    const ranked = rankLibrary(lib.photos, lib.sessions, target, filters, spotSchool);
    const slice = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return NextResponse.json({
      photos: await toPickerPhotos(client, slice, lib),
      total: ranked.length,
      page,
      pageSize: PAGE_SIZE,
      locations: locationOptions(lib.sessions.values()),
      categories: [...new Set([...lib.sessions.values()].map((s) => s.serviceType))].sort(),
    });
  } catch (error) {
    return jsonError(error, "Failed to load the photo library.");
  }
}

/** Builds (or reuses) the photo's public web copy after checking marketing permission. */
async function approvePhoto(client: SupabaseClient, photoId: string): Promise<string> {
  const { data: photo, error } = await client.from("session_photos")
    .select("id,photography_session_id,photography_sessions!inner(marketing_permission,marketing_permission_revoked_at)")
    .eq("id", photoId).maybeSingle();
  if (error) throw new Error(`could not load the photo: ${error.message}`);
  if (!photo) throw new BadRequest("Photo not found.");
  const embed = photo.photography_sessions as unknown as
    { marketing_permission: boolean; marketing_permission_revoked_at: string | null }
    | { marketing_permission: boolean; marketing_permission_revoked_at: string | null }[];
  const session = Array.isArray(embed) ? embed[0] : embed;
  if (!session?.marketing_permission || session.marketing_permission_revoked_at) {
    throw new BadRequest("This session does not have marketing permission.");
  }
  const [result] = await ensureDerivativesForPhotos(client, photo.photography_session_id as string, [photoId]);
  return result.url;
}

function revalidatePublicSite() {
  revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      throw new BadRequest("Invalid JSON body.");
    }
    const photoId = typeof body.photoId === "string" ? body.photoId.toLowerCase() : "";
    if (!isUuid(photoId)) throw new BadRequest("photoId must be a uuid.");
    const client = createSupabaseAdminClient();

    if (body.action === "approve") {
      return NextResponse.json({ url: await approvePhoto(client, photoId) });
    }

    if (body.action === "attach") {
      const target = parseTarget({ guide: body.guide, slug: body.slug });
      if (target.kind !== "guide") throw new BadRequest("Attach needs a guide gallery.");
      const hero = body.hero === true;
      if (body.approve === true) await approvePhoto(client, photoId);
      const { data, error } = await client.rpc("attach_existing_guide_photo", {
        p_guide: target.guide, p_slug: target.slug, p_session_photo_id: photoId,
        p_make_hero: hero, p_publish: hero,
      });
      if (error) {
        if (/not approved|marketing permission|not found/i.test(error.message)) throw new BadRequest(error.message);
        throw new Error(error.message);
      }
      revalidatePublicSite();
      return NextResponse.json(data);
    }

    throw new BadRequest("Unknown action.");
  } catch (error) {
    return jsonError(error, "Failed to update the guide photo.");
  }
}
