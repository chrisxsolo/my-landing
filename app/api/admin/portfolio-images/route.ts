// Admin API for portfolio_images. Gated by requireAdmin, writes via service-role
// (the public anon key can read via the public_read RLS policy but cannot write).

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TABLE = "portfolio_images";

function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

// POST: insert one image (object) or many (array). Returns the inserted rows.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const rows = Array.isArray(body) ? body : [body];
  if (!rows.length || rows.some((r) => !r || typeof r !== "object")) {
    return NextResponse.json({ error: "A portfolio image payload is required." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(TABLE).insert(rows).select();
    if (error) throw error;
    return NextResponse.json({ images: data ?? [] }, { status: 201 });
  } catch (error) {
    console.error("[admin/portfolio-images] POST failed:", error);
    const message = error instanceof Error ? error.message : "Failed to save image(s).";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH: update one image by id. Body = { id, updates }.
export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = parseId(body?.id);
  if (!id || typeof body?.updates !== "object" || body.updates === null) {
    return NextResponse.json({ error: "id and updates are required." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update(body.updates as Record<string, unknown>)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    return NextResponse.json({ image: data });
  } catch (error) {
    console.error("[admin/portfolio-images] PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE: remove one image by ?id=.
export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const id = parseId(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "A valid id is required." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/portfolio-images] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete image." }, { status: 500 });
  }
}
