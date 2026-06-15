// Admin API for the image_library gallery rows. Gated by requireAdmin and uses the
// service-role client. image_library has RLS enabled with no anon policy, so the
// public anon key can neither read nor write it — all access goes through here.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TABLE = "image_library";

function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

// GET: list all library rows, newest first (mirrors the admin gallery query).
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ images: data ?? [] });
  } catch (error) {
    console.error("[admin/library-images] GET failed:", error);
    return NextResponse.json({ error: "Failed to load image library." }, { status: 500 });
  }
}

// POST: insert a manually-uploaded library row.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body.image_url !== "string") {
    return NextResponse.json({ error: "image_url is required." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(TABLE).insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ image: data }, { status: 201 });
  } catch (error) {
    console.error("[admin/library-images] POST failed:", error);
    const message = error instanceof Error ? error.message : "Failed to save library image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH: update a library row by id. Body = { id, updates }.
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
    if (!data) return NextResponse.json({ error: "Library image not found." }, { status: 404 });
    return NextResponse.json({ image: data });
  } catch (error) {
    console.error("[admin/library-images] PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update library image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
