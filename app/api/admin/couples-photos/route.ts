// Admin API for couples-guide location galleries (couples_location_photos).
// Every method is gated by requireAdmin and uses the service-role client, so the
// public anon key can never write here. Uploads/deletes also manage the storage
// object in the couples-photos bucket, so deleting a photo never leaves an orphan.
// Mirrors app/api/admin/family-photos/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  COUPLES_PHOTOS_BUCKET,
  COUPLES_LOCATION_PHOTOS_TABLE,
  isValidCouplesLocationSlug,
  validateCouplesPhotoFile,
  validateAltText,
  safeCouplesFileName,
} from "@/lib/couplesPhotosAdmin";

export const dynamic = "force-dynamic";

const SELECT = "id,location_slug,image_url,storage_path,alt_text,caption,featured,published,sort_order,created_at,updated_at";

type PhotoRow = { id: string; storage_path: string | null };

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/couples-photos] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

async function nextSortOrder(supabase: ReturnType<typeof createSupabaseAdminClient>, slug: string) {
  const { data, error } = await supabase
    .from(COUPLES_LOCATION_PHOTOS_TABLE)
    .select("sort_order")
    .eq("location_slug", slug)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.sort_order ?? -1) + 1;
}

// ── GET: list a location's photos (all statuses, admin view) ──────────────────
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const slug = req.nextUrl.searchParams.get("location");
    if (!isValidCouplesLocationSlug(slug)) return NextResponse.json({ photos: [] });
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(COUPLES_LOCATION_PHOTOS_TABLE)
      .select(SELECT)
      .eq("location_slug", slug)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ photos: data ?? [] });
  } catch (error) {
    return jsonError(error, "Failed to load couples photos.");
  }
}

// ── POST (multipart): upload a new photo, or replace an existing one ──────────
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const slug = form.get("location_slug");
    const altText = form.get("alt_text");
    const caption = (form.get("caption") as string | null)?.trim() || null;
    const featured = form.get("featured") === "true";
    const replaceId = (form.get("replaceId") as string | null) || null;

    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    if (!isValidCouplesLocationSlug(slug)) throw new Error("Unknown couples location.");
    const fileCheck = validateCouplesPhotoFile(file);
    if (!fileCheck.ok) throw new Error(fileCheck.error);
    const altCheck = validateAltText(altText);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const supabase = createSupabaseAdminClient();
    const path = `${slug}/${crypto.randomUUID()}-${safeCouplesFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(COUPLES_PHOTOS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const image_url = supabase.storage.from(COUPLES_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;

    try {
      if (replaceId) {
        // Replace: point the existing row at the new object, then delete the old one.
        const { data: existing, error: readErr } = await supabase
          .from(COUPLES_LOCATION_PHOTOS_TABLE)
          .select("id,storage_path")
          .eq("id", replaceId)
          .eq("location_slug", slug)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!existing) throw new Error("The photo being replaced was not found.");

        const { data, error } = await supabase
          .from(COUPLES_LOCATION_PHOTOS_TABLE)
          .update({ image_url, storage_path: path, alt_text: (altText as string).trim(), caption })
          .eq("id", replaceId)
          .select(SELECT)
          .single();
        if (error) throw error;

        if (existing.storage_path) {
          const rm = await supabase.storage.from(COUPLES_PHOTOS_BUCKET).remove([existing.storage_path]);
          if (rm.error) console.error("[admin/couples-photos] old object cleanup failed", rm.error);
        }
        return NextResponse.json({ photo: data }, { status: 200 });
      }

      const sort_order = await nextSortOrder(supabase, slug);
      const { data, error } = await supabase
        .from(COUPLES_LOCATION_PHOTOS_TABLE)
        .insert({ location_slug: slug, image_url, storage_path: path, alt_text: (altText as string).trim(), caption, featured, published: false, sort_order })
        .select(SELECT)
        .single();
      if (error) throw error;
      return NextResponse.json({ photo: data }, { status: 201 });
    } catch (error) {
      // Roll back the just-uploaded object if the DB write failed.
      const rm = await supabase.storage.from(COUPLES_PHOTOS_BUCKET).remove([path]);
      if (rm.error) console.error("[admin/couples-photos] upload rollback failed", rm.error);
      throw error;
    }
  } catch (error) {
    return jsonError(error, "Failed to save the photo.", 400);
  }
}

// ── PATCH (json): update fields | reorder | set hero ──────────────────────────
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action;
    const supabase = createSupabaseAdminClient();

    if (action === "reorder") {
      const slug = body.location_slug;
      const ids = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x): x is string => typeof x === "string") : [];
      if (!isValidCouplesLocationSlug(slug)) throw new Error("Unknown couples location.");
      if (ids.length === 0) throw new Error("Nothing to reorder.");
      for (const [index, id] of ids.entries()) {
        const { error } = await supabase
          .from(COUPLES_LOCATION_PHOTOS_TABLE)
          .update({ sort_order: index })
          .eq("id", id)
          .eq("location_slug", slug);
        if (error) throw error;
      }
      return NextResponse.json({ reordered: ids.length });
    }

    if (action === "setHero") {
      const slug = body.location_slug;
      const id = body.id;
      if (!isValidCouplesLocationSlug(slug) || typeof id !== "string") throw new Error("Invalid hero selection.");
      // A single hero: feature the chosen photo, unfeature the rest in this location.
      const clear = await supabase.from(COUPLES_LOCATION_PHOTOS_TABLE).update({ featured: false }).eq("location_slug", slug);
      if (clear.error) throw clear.error;
      const { error } = await supabase.from(COUPLES_LOCATION_PHOTOS_TABLE).update({ featured: true }).eq("id", id).eq("location_slug", slug);
      if (error) throw error;
      return NextResponse.json({ hero: id });
    }

    // Default: field update on a single row.
    const id = body.id;
    if (typeof id !== "string") throw new Error("Missing photo id.");
    const updates: Record<string, unknown> = {};
    if (typeof body.caption === "string") updates.caption = body.caption.trim() || null;
    if (typeof body.published === "boolean") updates.published = body.published;
    if (typeof body.featured === "boolean") updates.featured = body.featured;
    if (typeof body.alt_text === "string") {
      const altCheck = validateAltText(body.alt_text);
      if (!altCheck.ok) throw new Error(altCheck.error);
      updates.alt_text = body.alt_text.trim();
    }
    if (Object.keys(updates).length === 0) throw new Error("No changes to apply.");

    const { data, error } = await supabase
      .from(COUPLES_LOCATION_PHOTOS_TABLE)
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return NextResponse.json({ photo: data });
  } catch (error) {
    return jsonError(error, "Failed to update the photo.", 400);
  }
}

// ── DELETE (json): remove a row and its storage object ────────────────────────
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) throw new Error("Missing photo id.");

    const supabase = createSupabaseAdminClient();
    const { data: row, error: readError } = await supabase
      .from(COUPLES_LOCATION_PHOTOS_TABLE)
      .select("id,storage_path")
      .eq("id", id)
      .maybeSingle<PhotoRow>();
    if (readError) throw readError;
    if (!row) throw new Error("Photo not found.");

    const { error: deleteError } = await supabase.from(COUPLES_LOCATION_PHOTOS_TABLE).delete().eq("id", id);
    if (deleteError) throw deleteError;

    let cleanupWarning: string | null = null;
    if (row.storage_path) {
      const { error } = await supabase.storage.from(COUPLES_PHOTOS_BUCKET).remove([row.storage_path]);
      if (error) {
        cleanupWarning = "Record deleted, but the storage file needs manual cleanup.";
        console.error("[admin/couples-photos] delete cleanup failed", error);
      }
    }
    return NextResponse.json({ deleted: id, cleanup_warning: cleanupWarning });
  } catch (error) {
    return jsonError(error, "Failed to delete the photo.", 400);
  }
}
