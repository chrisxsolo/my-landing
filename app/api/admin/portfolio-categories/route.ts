// Admin API for portfolio_categories. Gated by requireAdmin, writes via service-role.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TABLE = "portfolio_categories";

function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

// POST: insert a category.
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body.name !== "string" || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Category name and slug are required." }, { status: 400 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(TABLE).insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ category: data }, { status: 201 });
  } catch (error) {
    console.error("[admin/portfolio-categories] POST failed:", error);
    const message = error instanceof Error ? error.message : "Failed to save category.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH: update a category by id. Body = { id, updates }.
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
    if (!data) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    return NextResponse.json({ category: data });
  } catch (error) {
    console.error("[admin/portfolio-categories] PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update category.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE: remove a category by ?id=.
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
    console.error("[admin/portfolio-categories] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
