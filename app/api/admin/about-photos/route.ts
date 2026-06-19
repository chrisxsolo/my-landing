// Admin API for About-page fact photos (about_photos, one row per fact slug).
// Every method is gated by requireAdmin and uses the service-role client, so the
// public anon key can never write here. POST upserts: uploading for a slug that
// already has a photo replaces it and deletes the old storage object, so the
// bucket never accumulates orphans.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  ABOUT_FACTS,
  ABOUT_FACT_CONTENT_KEY,
  ABOUT_FACT_ORDER_KEY,
  ABOUT_PHOTOS_BUCKET,
  ABOUT_PHOTOS_TABLE,
  isValidAboutFactSlug,
  resolveAboutFacts,
  validateAboutFactContent,
} from "@/lib/aboutFacts";
import { validatePhotoAltText } from "@/lib/photoAdminShared";
import { isOwnedAdminUploadPath } from "@/lib/adminUploadTargets";

export const dynamic = "force-dynamic";

const SELECT = "id,fact_slug,image_url,storage_path,alt_text,created_at,updated_at";
const SITE_SETTINGS_TABLE = "site_settings";

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/about-photos] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

// ── GET: list photos + saved order + editable fact content ───────────────────
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(ABOUT_PHOTOS_TABLE).select(SELECT);
    if (error) throw error;

    const { data: settings, error: settingsError } = await supabase
      .from(SITE_SETTINGS_TABLE)
      .select("key,value")
      .in("key", [ABOUT_FACT_ORDER_KEY, ABOUT_FACT_CONTENT_KEY]);
    if (settingsError) throw settingsError;

    let order: string[] | null = null;
    let storedContent: unknown = null;
    for (const setting of settings ?? []) {
      try {
        const parsed = JSON.parse(setting.value);
        if (setting.key === ABOUT_FACT_ORDER_KEY && Array.isArray(parsed)) {
          order = parsed.filter(isValidAboutFactSlug);
        }
        if (setting.key === ABOUT_FACT_CONTENT_KEY) storedContent = parsed;
      } catch {
        console.error(`[admin/about-photos] corrupt ${setting.key} setting, ignoring`);
      }
    }
    return NextResponse.json({ photos: data ?? [], order, facts: resolveAboutFacts(storedContent) });
  } catch (error) {
    return jsonError(error, "Failed to load about photos.");
  }
}

// ── POST (json): register or replace the photo for a fact ─────────────────────
// The file is uploaded browser -> Storage first (app/api/admin/storage/sign), so
// only the storage_path + metadata arrive here.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const slug = body.fact_slug;
    const storagePath = typeof body.storage_path === "string" ? body.storage_path : "";
    const altText = body.alt_text;

    if (!isValidAboutFactSlug(slug)) throw new Error("Unknown about fact.");
    if (!isOwnedAdminUploadPath(storagePath, slug)) throw new Error("Invalid upload reference.");
    const altCheck = validatePhotoAltText(altText);
    if (!altCheck.ok) throw new Error(altCheck.error);

    const supabase = createSupabaseAdminClient();
    const image_url = supabase.storage.from(ABOUT_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;

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
          { fact_slug: slug, image_url, storage_path: storagePath, alt_text: (altText as string).trim(), updated_at: new Date().toISOString() },
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
      const rm = await supabase.storage.from(ABOUT_PHOTOS_BUCKET).remove([storagePath]);
      if (rm.error) console.error("[admin/about-photos] upload rollback failed", rm.error);
      throw error;
    }
  } catch (error) {
    return jsonError(error, "Failed to save the photo.", 400);
  }
}

// ── PATCH (json): edit fact content | reorder facts | update photo alt text ───
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = (await req.json()) as {
      action?: unknown;
      orderedSlugs?: unknown;
      fact_slug?: unknown;
      title?: unknown;
      body?: unknown;
      alt_text?: unknown;
    };

    if (body.action === "reorder") {
      const slugs = Array.isArray(body.orderedSlugs) ? body.orderedSlugs.filter(isValidAboutFactSlug) : [];
      if (new Set(slugs).size !== ABOUT_FACTS.length) throw new Error("Reorder must include every fact exactly once.");
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from(SITE_SETTINGS_TABLE).upsert(
        { key: ABOUT_FACT_ORDER_KEY, value: JSON.stringify(slugs), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (error) throw error;
      return NextResponse.json({ order: slugs });
    }
    if (body.action === "content") {
      if (!isValidAboutFactSlug(body.fact_slug)) throw new Error("Unknown about fact.");
      const contentCheck = validateAboutFactContent({ title: body.title, body: body.body });
      if (!contentCheck.ok) throw new Error(contentCheck.error);

      const supabase = createSupabaseAdminClient();
      const { data: setting, error: readError } = await supabase
        .from(SITE_SETTINGS_TABLE)
        .select("value")
        .eq("key", ABOUT_FACT_CONTENT_KEY)
        .maybeSingle();
      if (readError) throw readError;

      let storedContent: unknown = null;
      try {
        storedContent = setting?.value ? JSON.parse(setting.value) : null;
      } catch {
        console.error("[admin/about-photos] corrupt fact-content setting, replacing");
      }
      const contentBySlug = Object.fromEntries(
        resolveAboutFacts(storedContent).map((fact) => [fact.slug, { title: fact.title, body: fact.body }]),
      );
      contentBySlug[body.fact_slug] = contentCheck.content;

      const { error } = await supabase.from(SITE_SETTINGS_TABLE).upsert(
        { key: ABOUT_FACT_CONTENT_KEY, value: JSON.stringify(contentBySlug), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (error) throw error;
      return NextResponse.json({ fact: { slug: body.fact_slug, ...contentCheck.content } });
    }
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
