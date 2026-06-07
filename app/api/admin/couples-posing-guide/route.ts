import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { listCouplesInspirationImages } from "@/lib/couplesInspiration";
import {
  COUPLES_INSPIRATION_BUCKET,
  COUPLES_INSPIRATION_TABLE,
  getOwnedStoragePaths,
  validateInspirationImageInput,
  validateInspirationUpload,
} from "@/lib/couplesPosingGuide";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type ImageRow = {
  id: string;
  storage_path: string | null;
  external_source_url: string | null;
  title: string;
  internal_notes: string | null;
  client_notes: string | null;
  creator_name: string | null;
  attribution_text: string | null;
  categories: string[];
  tags: string[];
  related_prompt_number: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility: string;
  is_published: boolean;
  display_order: number;
  rights_confirmed: boolean;
};

function jsonError(error: unknown, fallback: string, status = 500) {
  console.error(`[admin/couples-posing-guide] ${fallback}`, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

function safeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "inspiration-image";
}

function parseMetadata(value: FormDataEntryValue | null) {
  if (typeof value !== "string") throw new Error("Image metadata is required.");
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return parsed;
}

function omitFields(
  data: Record<string, unknown>,
  fields: string[],
) {
  const excluded = new Set(fields);
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !excluded.has(key)),
  );
}

async function insertExternalReference(body: Record<string, unknown>) {
  const validation = validateInspirationImageInput({
    ...body,
    storage_path: null,
    visibility: "private",
    is_published: false,
    rights_confirmed: false,
  });
  if (!validation.ok) throw new Error(validation.error);
  if (!validation.data.external_source_url) throw new Error("Source URL is required.");

  const supabase = createSupabaseAdminClient();
  const nextOrder = await getNextDisplayOrder();
  const row = omitFields(validation.data, ["owns_storage_object"]);
  const { data, error } = await supabase
    .from(COUPLES_INSPIRATION_TABLE)
    .insert({ ...row, display_order: row.display_order || nextOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getNextDisplayOrder() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(COUPLES_INSPIRATION_TABLE)
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.display_order ?? 0) + 1;
}

async function uploadImages(formData: FormData) {
  const metadata = parseMetadata(formData.get("metadata"));
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);
  if (files.length === 0) throw new Error("Choose at least one image.");

  for (const file of files) {
    const validation = validateInspirationUpload(file);
    if (!validation.ok) throw new Error(validation.error);
  }

  const supabase = createSupabaseAdminClient();
  const year = new Date().getUTCFullYear();
  const uploadedPaths: string[] = [];
  const nextOrder = await getNextDisplayOrder();

  try {
    const rows = [];
    for (const [index, file] of files.entries()) {
      const path = `${year}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from(COUPLES_INSPIRATION_BUCKET)
        .upload(path, await file.arrayBuffer(), {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(path);

      const validation = validateInspirationImageInput({
        ...metadata,
        storage_path: path,
        external_source_url: null,
      });
      if (!validation.ok) throw new Error(validation.error);
      const row = omitFields(validation.data, ["owns_storage_object"]);
      rows.push({
        ...row,
        display_order: row.display_order || nextOrder + index,
      });
    }

    const { data, error } = await supabase
      .from(COUPLES_INSPIRATION_TABLE)
      .insert(rows)
      .select("*");
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const cleanup = await supabase.storage
        .from(COUPLES_INSPIRATION_BUCKET)
        .remove(uploadedPaths);
      if (cleanup.error) {
        console.error("[admin/couples-posing-guide] upload rollback failed", cleanup.error);
      }
    }
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json({ images: await listCouplesInspirationImages("photographer") });
  } catch (error) {
    return jsonError(error, "Failed to load inspiration images.");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const images = contentType.includes("multipart/form-data")
      ? await uploadImages(await req.formData())
      : [await insertExternalReference(await req.json() as Record<string, unknown>)];
    return NextResponse.json({ images }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to add inspiration image.", 400);
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = await req.json() as {
      ids?: unknown;
      updates?: Record<string, unknown>;
    };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) throw new Error("Select at least one image.");

    const supabase = createSupabaseAdminClient();
    const { data: current, error: currentError } = await supabase
      .from(COUPLES_INSPIRATION_TABLE)
      .select("*")
      .in("id", ids)
      .returns<ImageRow[]>();
    if (currentError) throw currentError;
    if (!current?.length) throw new Error("No matching images were found.");

    for (const image of current) {
      const validation = validateInspirationImageInput({
        ...image,
        ...(body.updates ?? {}),
      });
      if (!validation.ok) throw new Error(validation.error);
      const updates = omitFields(validation.data, [
        "owns_storage_object",
        "storage_path",
        "external_source_url",
      ]);
      const { error } = await supabase
        .from(COUPLES_INSPIRATION_TABLE)
        .update(updates)
        .eq("id", image.id);
      if (error) throw error;
    }

    return NextResponse.json({ updated: current.length });
  } catch (error) {
    return jsonError(error, "Failed to update inspiration images.", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const body = await req.json() as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) throw new Error("Select at least one image.");

    const supabase = createSupabaseAdminClient();
    const { data: rows, error: readError } = await supabase
      .from(COUPLES_INSPIRATION_TABLE)
      .select("id,storage_path,external_source_url")
      .in("id", ids);
    if (readError) throw readError;

    const { error: deleteError } = await supabase
      .from(COUPLES_INSPIRATION_TABLE)
      .delete()
      .in("id", ids);
    if (deleteError) throw deleteError;

    const paths = getOwnedStoragePaths(rows ?? []);
    let cleanupWarning: string | null = null;
    if (paths.length > 0) {
      const { error } = await supabase.storage
        .from(COUPLES_INSPIRATION_BUCKET)
        .remove(paths);
      if (error) {
        cleanupWarning = "Records were deleted, but some storage files need manual cleanup.";
        console.error("[admin/couples-posing-guide] delete cleanup failed", error);
      }
    }

    return NextResponse.json({ deleted: rows?.length ?? 0, cleanup_warning: cleanupWarning });
  } catch (error) {
    return jsonError(error, "Failed to delete inspiration images.", 400);
  }
}
