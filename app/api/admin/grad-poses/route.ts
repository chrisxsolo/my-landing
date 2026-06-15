import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const GRAD_POSES_TABLE = "grad_poses";

async function readBody(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { title, instructions, image_url, order } = body as Record<string, unknown>;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(GRAD_POSES_TABLE)
      .insert({ title, instructions, image_url, order })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ pose: data });
  } catch (error) {
    console.error("[admin/grad-poses] POST failed:", error);
    return NextResponse.json({ error: "Failed to create pose." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = await readBody(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id, updates } = body as { id?: unknown; updates?: unknown };
  if (typeof id !== "number") {
    return NextResponse.json({ error: "A numeric id is required." }, { status: 400 });
  }
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Updates are required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(GRAD_POSES_TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Pose not found." }, { status: 404 });
    return NextResponse.json({ pose: data });
  } catch (error) {
    console.error("[admin/grad-poses] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update pose." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "A numeric id is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from(GRAD_POSES_TABLE)
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    if (!count) return NextResponse.json({ error: "Pose not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/grad-poses] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete pose." }, { status: 500 });
  }
}
