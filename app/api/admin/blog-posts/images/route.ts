// The images a live blog post renders, by post id — for every post, including
// the legacy ones with no Content Engine item. GET lists the inventory (cover,
// gallery, social image, each with its source column and session photo);
// DELETE removes one gallery photo; PATCH replaces the cover together with the
// social image. Every write refreshes the public cache.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import {
  loadPostImageInventory, PostImagesError, removePostGalleryImage, replacePostCover,
} from "@/lib/blog/publishedImages";

export const dynamic = "force-dynamic";

const HTTPS_URL = /^https:\/\/\S+$/;

function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorResponse(err: unknown, fallback: string) {
  if (err instanceof PostImagesError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[admin/blog-posts/images] ${fallback}`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const postId = parseId(req.nextUrl.searchParams.get("id"));
  if (!postId) return NextResponse.json({ error: "A valid post id is required." }, { status: 400 });
  try {
    return NextResponse.json(await loadPostImageInventory(createSupabaseAdminClient(), postId));
  } catch (err) {
    return errorResponse(err, "Failed to load the post's images.");
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readBody(req);
  const postId = parseId(body?.id);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!postId || !HTTPS_URL.test(url)) return NextResponse.json({ error: "id and an https url are required." }, { status: 400 });
  try {
    const result = await removePostGalleryImage(createSupabaseAdminClient(), postId, url);
    revalidatePublicContent();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to remove the photo.");
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readBody(req);
  const postId = parseId(body?.id);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!postId || body?.action !== "replace-cover" || !HTTPS_URL.test(url)) {
    return NextResponse.json({ error: "id, action replace-cover and an https url are required." }, { status: 400 });
  }
  try {
    const result = await replacePostCover(createSupabaseAdminClient(), {
      postId, url, keepOldInGallery: body?.keepOldInGallery === true,
    });
    revalidatePublicContent();
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to replace the cover.");
  }
}
