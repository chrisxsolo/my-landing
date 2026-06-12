// Admin API for About-page fact photos (about_photos, one row per fact slug).
// Every method is gated by requireAdmin and uses the service-role client, so the
// public anon key can never write here. POST upserts: uploading for a slug that
// already has a photo replaces it and deletes the old storage object, so the
// bucket never accumulates orphans.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import { ABOUT_PHOTOS_BUCKET, ABOUT_PHOTOS_TABLE, isValidAboutFactSlug } from "@/lib/aboutFacts";
import { validateAdminPhotoFile, validatePhotoAltText, safePhotoFileName } from "@/lib/photoAdminShared";

export const dynamic = "force-dynamic";

const SELECT = "id,fact_slug,image_url,storage_path,alt_text,created_at,updated_at";

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/about-photos] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

// ── GET: list every fact photo ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(ABOUT_PHOTOS_TABLE).select(SELECT);
    if (error) throw error;
    return NextResponse.json({ photos: data ?? [] });
  } catch (error) {
    return jsonError(error, "Failed to load about photos.");
  }
}

// ── POST (multipart): upload or replace the photo for a fact ──────────────────
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const slug = form.get("fact_slug");
    const altText = form.get("alt_text");

    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    if (!isValidAboutFactSlug(slug)) throw new Error("Unknown about fact.");
    const fileCheck = validateAdminPhotoFile(file);
    if (!fileCheck.ok) throw new Error(fileCheck.error);
    const altCheck = validatePhotoAltText(altText);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const supabase = createSupabaseAdminClient();
    const path = `${slug}/${crypto.randomUUID()}-${safePhotoFileName(file.name, "about-photo")}`;

    const { error: uploadError } = await supabase.storage
      .from(ABOUT_PHOTOS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const image_url = supabase.storage.from(ABOUT_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;

    try {
      const { data: existing, error: readErr } = await supabase
        .from(ABOUT_PHOTOS_TABLE)
        .select("id,storage_path")
        .eq("fact_slug", slug)
        .maybeSingle();
      if (readErr) throw readErr;

      const { data, error } = await supabase
        .from(ABOUT_PHOTOS_TABLE)
        .upsert(
          { fact_slug: slug, image_url, storage_path: path, alt_text: (altText as string).trim(), updated_at: new Date().toISOString() },
          { onConflict: "fact_slug" },
        )
        .select(SELECT)
        .single();
      if (error) throw error;

      if (existing?.storage_path) {
        const rm = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([existing.storage_path]);
        if (rm.error) console.error("[admin/about-photos] old object cleanup failed", rm.error);
      }
      return NextResponse.json({ photo: data }, { status: existing ? 200 : 201 });
    } catch (error) {
      // Roll back the just-uploaded object if the DB write failed.
      const rm = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([path]);
      if (rm.error) console.error("[admin/about-photos] upload rollback failed", rm.error);
      throw error;
    }
  } catch (error) {
    return jsonError(error, "Failed to save the photo.", 400);
  }
}

// ── PATCH (json): update alt text for a fact's photo ──────────────────────────
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { fact_slug?: unknown; alt_text?: unknown };
    if (!isValidAboutFactSlug(body.fact_slug)) throw new Error("Unknown about fact.");
    const altCheck = validatePhotoAltText(body.alt_text);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(ABOUT_PHOTOS_TABLE)
      .update({ alt_text: (body.alt_text as string).trim(), updated_at: new Date().toISOString() })
      .eq("fact_slug", body.fact_slug)
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No photo exists for that fact yet.");
    return NextResponse.json({ photo: data });
  } catch (error) {
    return jsonError(error, "Failed to update the photo.", 400);
  }
}

// ── DELETE (json): remove a fact's photo row and storage object ───────────────
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as { fact_slug?: unknown };
    if (!isValidAboutFactSlug(body.fact_slug)) throw new Error("Unknown about fact.");

    const supabase = createSupabaseAdminClient();
    const { data: row, error: readError } = await supabase
      .from(ABOUT_PHOTOS_TABLE)
      .select("id,storage_path")
      .eq("fact_slug", body.fact_slug)
      .maybeSingle();
    if (readError) throw readError;
    if (!row) throw new Error("No photo exists for that fact.");

    const { error: deleteError } = await supabase.from(ABOUT_PHOTOS_TABLE).delete().eq("id", row.id);
    if (deleteError) throw deleteError;

    let cleanupWarning: string | null = null;
    if (row.storage_path) {
      const { error } = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([row.storage_path]);
      if (error) {
        cleanupWarning = "Record deleted, but the storage file needs manual cleanup.";
        console.error("[admin/about-photos] delete cleanup failed", error);
      }
    }
    return NextResponse.json({ deleted: body.fact_slug, cleanup_warning: cleanupWarning });
  } catch (error) {
    return jsonError(error, "Failed to delete the photo.", 400);
  }
}
